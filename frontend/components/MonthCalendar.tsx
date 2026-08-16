// 本月支出日历：一格一天，显示当天支出金额；有支出的日子统一显示浅浅的靛蓝底色
// （不按金额分档变深）；固定 6 行（42 格），前后不足的格子补上/下月日期（灰色小字、
// 不可点击），保证卡片高度恒定；点击某天联动下方记录列表（再点同一天取消）。
import { useMemo } from 'react'
import { localDateString } from '../data/dateUtils'
import { getDayExtra, type DayExtra } from '../data/lunarUtils'

interface Props {
  /** 显示的月份，格式 YYYY-MM */
  month: string
  /** 每天支出金额（仅含当天有记录的日期），key 为 YYYY-MM-DD */
  amountByDay: Map<string, number>
  /** 当前选中的日期（null = 未选中） */
  selectedDay: string | null
  /** 点击某天回调：传入该日期；再次点击同一天传 null 表示取消 */
  onSelectDay: (day: string | null) => void
  /** 悬停某天回调（null = 鼠标移出日历区域）：右侧农历黄历面板跟随悬停显示 */
  onHoverDay?: (day: string | null) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 日历格子金额：≥10 万缩写为「x.x万」，其余取整到元（悬浮提示里有完整金额）
function compactAmount(v: number): string {
  if (v >= 100000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${Math.round(v)}`
}

// 农历小字样式：节日红 / 节气绿 / 农历灰 / 调休「班」灰底（底色恒为浅色，无需深色分支）
function extraClass(extra: DayExtra): string {
  switch (extra.kind) {
    case 'festival':
      return 'text-red-500 font-medium'
    case 'jieqi':
      return 'text-emerald-600'
    case 'work':
      return 'text-slate-500 bg-slate-200 rounded px-0.5'
    default:
      return 'text-slate-400'
  }
}

// 固定 6 行 × 7 列 = 42 格（行数恒定，卡片高度不随月份变化）
const TOTAL_CELLS = 42

export default function MonthCalendar({ month, amountByDay, selectedDay, onSelectDay, onHoverDay }: Props) {
  const [y, m] = month.split('-').map(Number)
  const firstWeekday = new Date(y, m - 1, 1).getDay() // 0 = 周日
  const daysInMonth = new Date(y, m, 0).getDate()
  const prevMonthLast = new Date(y, m - 1, 0).getDate() // 上月最后一天（前缀补格用）
  const today = localDateString()

  // 42 格 = 上月月末（前缀补格） + 当月 + 下月月初（后缀补满）；other = 邻月格子
  const cells = useMemo(() => {
    const list: { day: number; other: boolean }[] = []
    for (let i = firstWeekday - 1; i >= 0; i--) list.push({ day: prevMonthLast - i, other: true })
    for (let d = 1; d <= daysInMonth; d++) list.push({ day: d, other: false })
    for (let d = 1; list.length < TOTAL_CELLS; d++) list.push({ day: d, other: true })
    return list
  }, [firstWeekday, prevMonthLast, daysInMonth])

  return (
    <div onMouseLeave={() => onHoverDay?.(null)}>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[11px] text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-0.5">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          // 邻月补格：只显示灰色日期数字，不可点击（保持占位，让行数恒定）
          if (cell.other) {
            return (
              <div
                key={`other-${idx}`}
                className="flex flex-col items-center justify-center aspect-square rounded-lg"
              >
                <span className="text-xs text-slate-300">{cell.day}</span>
              </div>
            )
          }
          const date = `${month}-${String(cell.day).padStart(2, '0')}`
          const amount = amountByDay.get(date)
          const hasAmount = amount != null
          const isToday = date === today
          const isSelected = date === selectedDay
          // 背景：有支出的日子统一浅靛蓝底（不按金额分档）；选中/今天状态叠加在浅色之上
          const bgClass = hasAmount
            ? 'bg-indigo-100'
            : isToday
              ? 'bg-indigo-50'
              : isSelected
                ? 'bg-indigo-100'
                : 'bg-slate-50'
          // 有支出的格子去掉描边（浅色块本身即信息）；选中加深色外圈高亮
          const borderClass = hasAmount
            ? 'border-transparent'
            : isToday
              ? 'border-primary/40'
              : 'border-slate-100'
          const ringClass = isSelected ? 'ring-2 ring-slate-800/60' : ''
          // 日期数字：今天用主题色圆形徽标；其余统一深色字（底色恒为浅色）
          const dayNumber =
            isToday ? (
              <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center leading-none">
                {cell.day}
              </span>
            ) : (
              <span className={`text-[11px] font-medium leading-none ${isSelected ? 'text-primary' : 'text-slate-500'}`}>
                {cell.day}
              </span>
            )
          // 金额文字：有支出深字，无支出显示浅色占位符
          const amountClass =
            hasAmount ? 'text-slate-700'
              : isSelected ? 'text-slate-400'
                : 'text-slate-300'
          // 农历小字：节日 > 节气 > 农历日（大厂通用规则）
          const extra = getDayExtra(date)
          const extraCls = extraClass(extra)
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : date)}
              onMouseEnter={() => onHoverDay?.(date)}
              title={amount != null ? `${date} 支出 ¥${amount.toFixed(2)}（点击查看当天记录）` : `${date} 无支出（点击可添加当天记录）`}
              className={`flex flex-col items-center justify-center gap-0 aspect-square rounded-lg border transition-colors overflow-hidden ${bgClass} ${borderClass} ${ringClass} ${
                hasAmount ? 'hover:brightness-95' : 'hover:bg-indigo-50/60 hover:border-primary/40'
              }`}
            >
              {dayNumber}
              <span className={`text-[10px] leading-tight tabular-nums max-w-full truncate px-0.5 ${amountClass}`}>
                {amount != null ? compactAmount(amount) : '—'}
              </span>
              <span className={`text-[9px] leading-tight max-w-full truncate px-0.5 ${extraCls}`}>
                {extra.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
