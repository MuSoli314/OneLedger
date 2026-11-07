// 小类规则的条件面板
//
// 点规则上的条件标签后，在那一行下面展开这个小面板，用来勾「这条规则什么时候生效」。
//
// 几个关键约定（产品决策，见设计文档第 3 / 7 节）：
//  · 顶部「总是」= 清空条件（匹配所有日期）；它是普通规则，不是兜底功能。
//  · 工作日 / 休息日 二选一（再点一次取消）。
//  · 每周 / 每月 都可以多选；**同一类多选 = 或**（周一或周三都算命中）。
//  · 不同类条件可以叠加，**不同类之间 = 且**（例如「工作日」+「每月 1 号」）。
//  · 每点一下就通过 onChange 立即保存（没有「确定」按钮）——条件就几项，改完马上生效最省心。
import { WEEKDAY_SHORT, describeCondition } from '../data/subcategoryRules'
import type { RuleCondition, RuleConditionKind } from '../data/types'

interface Props {
  conditions: RuleCondition[]
  /** 条件一变就回调，由外层负责立即落库 */
  onChange: (conditions: RuleCondition[]) => void
}

// 条件在规则里的固定排列顺序（也决定面板里小标签的先后），让界面看起来稳定不跳
const KIND_ORDER: RuleConditionKind[] = ['workday', 'rest', 'weekday', 'monthday', 'annual']

/** 把某一种条件换掉（传 null = 删除这一类条件），其余条件保持不动并按固定顺序排好 */
function setCondition(
  conditions: RuleCondition[],
  kind: RuleConditionKind,
  next: RuleCondition | null,
): RuleCondition[] {
  const others = conditions.filter((c) => c.kind !== kind)
  if (!next) return others
  return [...others, next].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** 某月有多少天（用闰年 2024 算，2 月给 29 天；只用于「每年」的日期下拉，不做严格年历） */
function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate()
}

/** 面板里统一样式的小按钮：选中 = 主色底白字；未选中 = 白底描边（模块本身是浅灰底，白底更清楚） */
function Pill({
  active,
  onClick,
  children,
  className = '',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-xs transition-colors ${
        active
          ? 'bg-primary text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * 一个「选择模块」= 浅灰底小卡片 + 标题（+ 可选小提示）。
 * 每月 / 每周 / 每年 / 日期类型 各自一块底色，一眼能分清哪几个格子是一组。
 */
function Module({
  title,
  hint,
  className = '',
  children,
}: {
  title: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-2 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mb-1.5">
        <span className="text-[11px] font-medium text-slate-500">{title}</span>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default function RuleConditionPanel({ conditions, onChange }: Props) {
  const hasWorkday = conditions.some((c) => c.kind === 'workday')
  const hasRest = conditions.some((c) => c.kind === 'rest')
  const weekdayDays = conditions.find((c) => c.kind === 'weekday')?.days ?? []
  const monthDays = conditions.find((c) => c.kind === 'monthday')?.days ?? []
  const annual = conditions.find((c) => c.kind === 'annual')

  /** 工作日 / 休息日互斥：选了其中一个就把另一个去掉；再点一次自己 = 取消 */
  const toggleWorkday = () => {
    if (hasWorkday) {
      onChange(setCondition(conditions, 'workday', null))
    } else {
      // 休息日和「工作日」语义冲突，一起清掉，避免保存出永远匹配不上的条件
      onChange(setCondition(setCondition(conditions, 'rest', null), 'workday', { kind: 'workday' }))
    }
  }
  const toggleRest = () => {
    if (hasRest) {
      onChange(setCondition(conditions, 'rest', null))
    } else {
      onChange(setCondition(setCondition(conditions, 'workday', null), 'rest', { kind: 'rest' }))
    }
  }

  /** 每周：点某个星期几 = 选中/取消（多选 = 或） */
  const toggleWeekday = (day: number) => {
    const nextDays = weekdayDays.includes(day)
      ? weekdayDays.filter((d) => d !== day)
      : [...weekdayDays, day].sort((a, b) => a - b)
    onChange(
      nextDays.length === 0
        ? setCondition(conditions, 'weekday', null)
        : setCondition(conditions, 'weekday', { kind: 'weekday', days: nextDays }),
    )
  }

  /** 每月：点某个号数 = 选中/取消（多选 = 或） */
  const toggleMonthDay = (day: number) => {
    const nextDays = monthDays.includes(day)
      ? monthDays.filter((d) => d !== day)
      : [...monthDays, day].sort((a, b) => a - b)
    onChange(
      nextDays.length === 0
        ? setCondition(conditions, 'monthday', null)
        : setCondition(conditions, 'monthday', { kind: 'monthday', days: nextDays }),
    )
  }

  /** 每年：月份 / 日期都是必填，选了一个就自动补另一个（默认 1 月 1 日），不完整就当没设置 */
  const changeAnnualMonth = (value: string) => {
    const month = Number(value)
    if (!month) {
      onChange(setCondition(conditions, 'annual', null))
      return
    }
    const day = Math.min(annual?.day ?? 1, daysInMonth(month))
    onChange(setCondition(conditions, 'annual', { kind: 'annual', month, day }))
  }
  const changeAnnualDay = (value: string) => {
    const day = Number(value)
    if (!day) {
      onChange(setCondition(conditions, 'annual', null))
      return
    }
    // 还没选月份时先按 1 月算，用户接着选月份时会自动修正天数
    onChange(setCondition(conditions, 'annual', { kind: 'annual', month: annual?.month ?? 1, day }))
  }

  // 「每年」日期下拉的可选范围：选了月份就只给这个月的有效天数，没选月份给 1–31
  const annualDayMax = annual?.month ? daysInMonth(annual.month) : 31

  return (
    <div className="w-full max-w-[600px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* 已选条件：并排的小标签，可单个删掉（不同类条件之间是「且」） */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400">已选条件：</span>
        {conditions.length === 0 ? (
          <span className="text-[11px] text-slate-400">不设条件（总是生效）</span>
        ) : (
          conditions.map((c, idx) => (
            <span
              key={`${c.kind}-${idx}`}
              className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded px-1.5 py-0.5"
            >
              {describeCondition(c)}
              <button
                type="button"
                onClick={() => onChange(conditions.filter((_, i) => i !== idx))}
                className="text-primary/60 hover:text-primary leading-none"
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      {/* 左边三个小模块竖排，右边「每月」单独一列：31 个号的格子最高，正好把右边这块空间占满 */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
        {/* 左列：日期类型 / 每周 / 每年 */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Module title="日期类型" hint="总是 = 清空全部条件">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Pill active={conditions.length === 0} onClick={() => onChange([])}>
                总是
              </Pill>
              <Pill active={hasWorkday} onClick={toggleWorkday}>
                工作日
              </Pill>
              <Pill active={hasRest} onClick={toggleRest}>
                休息日
              </Pill>
            </div>
          </Module>

          {/* 每周（多选 = 或） */}
          <Module title="每周" hint="可多选">
            <div className="flex items-center gap-1 flex-wrap">
              {WEEKDAY_SHORT.slice(1).map((label, i) => {
                const day = i + 1
                const active = weekdayDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`w-7 h-7 rounded-md text-xs transition-colors ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Module>

          {/* 每年（月份 + 日期） */}
          <Module title="每年" hint="某一年的某月某日">
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={annual?.month ?? ''}
                onChange={(e) => changeAnnualMonth(e.target.value)}
                className={`text-xs border rounded-md px-1.5 h-7 bg-white focus:outline-none focus:border-primary ${
                  annual?.month ? 'text-slate-700 border-slate-300' : 'text-slate-400 border-slate-300'
                }`}
              >
                <option value="">月份</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
              <select
                value={annual?.day ?? ''}
                onChange={(e) => changeAnnualDay(e.target.value)}
                className={`text-xs border rounded-md px-1.5 h-7 bg-white focus:outline-none focus:border-primary ${
                  annual?.day ? 'text-slate-700 border-slate-300' : 'text-slate-400 border-slate-300'
                }`}
              >
                <option value="">日期</option>
                {Array.from({ length: annualDayMax }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} 日
                  </option>
                ))}
              </select>
              {annual && (
                <button
                  type="button"
                  onClick={() => onChange(setCondition(conditions, 'annual', null))}
                  className="text-[11px] text-slate-400 hover:text-red-500"
                >
                  清除
                </button>
              )}
            </div>
          </Module>
        </div>

        {/* 右列：每月（多选 = 或） */}
        <Module title="每月" hint="可多选" className="w-full flex-shrink-0 sm:w-[254px]">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const active = monthDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleMonthDay(day)}
                  className={`h-7 rounded-md text-[11px] tabular-nums transition-colors ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </Module>
      </div>
    </div>
  )
}
