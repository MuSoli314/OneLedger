// 记账页顶部：左侧支出日历（可自选月份，默认本月；每天格子显示支出金额，点击某天 = 在时间范围里
// 「自定义」选中该天）；右侧按天支出趋势图（原「当月支出」图，只是换了个位置：标题=当前时间范围
// 标签、跟随范围选择器与记账列表联动）。
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { getDailyTotals, getDailyTotalsByNonDaily, getMonths } from '../data/database'
import { eachDay, localMonthString, formatMonth, getRangeDates } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import { DailyDualLineChart } from './TrendChart'
import MonthCalendar from './MonthCalendar'
import HoverTip from './HoverTip'
import LunarCard, { type LunarHoverBridge } from './LunarCard'
import type { DailyNonDailyPoint, DailyTrendPoint } from '../data/types'

interface Props {
  dataVersion: number // 数据版本号：记录增删改后 HomePage 自增，触发重新查库
  startDate: string // 折线图数据范围（与记账列表联动）
  endDate: string
  title: string // 折线图标题（当前时间范围标签）
  selectedDay: string | null // 日历选中的日期（由 HomePage 从「自定义单天范围」推导）
  onSelectDay: (day: string | null) => void
  /** 时间范围对应的整月（本月 / 历史月份 / 上月时为该月，其余范围 null）：蓝色模块切换时日历跟随 */
  syncMonth: string | null
  /** 日历选月份回调：HomePage 据此把时间范围切到「历史月份」该月或「本月」 */
  onMonthChange: (month: string) => void
  /** 月锁集合（YYYY-MM）：只看月锁属性，与日锁互不影响 */
  lockedMonths: Set<string>
  /** 日锁集合（YYYY-MM-DD）：日历格子按「月锁 或 日锁」显示锁图标 */
  lockedDays: Set<string>
  /** 点击整月锁按钮：锁 / 解锁当前视图月份（只写月属性，不动任何日属性） */
  onToggleMonthLock: (month: string) => void
}

export default function MonthOverview({ dataVersion, startDate, endDate, title, selectedDay, onSelectDay, syncMonth, onMonthChange, lockedMonths, lockedDays, onToggleMonthLock }: Props) {
  const { categories } = useCategories()
  const [activeCategory, setActiveCategory] = useState('') // '' = 全天（只作用于右侧折线图）
  const [daily, setDaily] = useState<DailyTrendPoint[]>([])
  const [dual, setDual] = useState<DailyNonDailyPoint[]>([])
  // 日历显示的月份（默认本月；左右箭头微调 + 下拉直接跳，且与时间范围选择器联动）
  const [viewMonth, setViewMonth] = useState(localMonthString())
  const [months, setMonths] = useState<string[]>([]) // 有记录的月份（供日历月份下拉）

  // 黄历悬停桥：日历在左列、黄历卡在右列，悬停事件经此 ref 直达黄历卡内部 setter。
  // 悬停不在这里存 state，MonthOverview（含折线图）就不会因悬停而重渲染。
  const hoverBridgeRef = useRef<LunarHoverBridge | null>(null)
  const handleCalendarHover = useCallback((day: string | null) => {
    hoverBridgeRef.current?.setHoverDay(day)
  }, [])

  const thisMonth = localMonthString()

  // 蓝色模块切到整月范围（本月 / 历史月份 / 上月）时，日历跟随该月
  useEffect(() => {
    if (syncMonth && syncMonth !== viewMonth) setViewMonth(syncMonth)
  }, [syncMonth, viewMonth])

  // 有记录月份下拉数据（记录增删改后随 dataVersion 刷新）
  useEffect(() => {
    getMonths().then(setMonths).catch(console.error)
  }, [dataVersion])

  // 日历视图月份的起止（自选月份，默认本月）
  const viewRange = useMemo(() => getRangeDates('history', viewMonth), [viewMonth])

  // 日历金额：所选月份的每日支出
  useEffect(() => {
    getDailyTotals(viewRange.start, viewRange.end).then(setDaily).catch(console.error)
  }, [viewRange.start, viewRange.end, dataVersion])

  // 折线图：跟随时间范围选择器（与记账列表联动），可按大类筛选
  useEffect(() => {
    getDailyTotalsByNonDaily(startDate, endDate, activeCategory || undefined).then(setDual).catch(console.error)
  }, [startDate, endDate, activeCategory, dataVersion])

  // 日历每天的金额（只含当天有记录的日期）
  const amountByDay = useMemo(() => new Map(daily.map((d) => [d.date, d.total])), [daily])

  // 折线图数据：把范围内无记录的日期补 0，保证折线连续；全天 = 日常 + 非日常
  const dualMap = useMemo(() => new Map(dual.map((d) => [d.date, d])), [dual])
  const filledDual = useMemo(
    () =>
      eachDay(startDate, endDate).map((d) => {
        const day = dualMap.get(d) ?? { dailyTotal: 0, nonDailyTotal: 0 }
        return { date: d, dailyTotal: day.dailyTotal, allTotal: day.dailyTotal + day.nonDailyTotal }
      }),
    [startDate, endDate, dualMap]
  )

  // 月份下拉选项：有记录的月份 + 当前视图月份 + 本月（去重、按时间倒序）
  const monthOptions = useMemo(() => {
    const set = new Set<string>([...months, viewMonth, thisMonth])
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [months, viewMonth, thisMonth])

  // 月份前后翻（跨年自动处理），并联动时间范围选择器
  const shiftMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setViewMonth(next)
    onMonthChange(next)
  }

  // 下拉：设置月份并联动时间范围选择器
  const changeMonth = (next: string) => {
    setViewMonth(next)
    onMonthChange(next)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-6">
      {/* 左侧（1/3）：支出日历（可自选月份，默认本月；日期为正方形格子） */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 bg-indigo-100/90 rounded-full px-2.5 py-1">📅 支出日历</span>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              title="上个月"
            >
              ‹
            </button>
            <select
              value={viewMonth}
              onChange={(e) => changeMonth(e.target.value)}
              className="h-7 bg-white border border-slate-200 rounded-lg px-2 text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary"
              title="选择月份"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              title="下个月"
            >
              ›
            </button>
          </div>
          {/* 整月锁按钮：只反映「月锁」属性；月锁生效时该月每天都是锁定的（含未来日期） */}
          <HoverTip
            className="shrink-0"
            align="right"
            text={lockedMonths.has(viewMonth) ? '点击解锁' : '点击锁定（整月只读）'}
          >
            <button
              type="button"
              onClick={() => onToggleMonthLock(viewMonth)}
              aria-label={lockedMonths.has(viewMonth) ? '解锁整月' : '锁定整月'}
              className={`inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 border transition-colors shrink-0 ${
                lockedMonths.has(viewMonth)
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {lockedMonths.has(viewMonth) ? '🔒 解锁' : '🔓 锁定'}
            </button>
          </HoverTip>
        </div>
        <MonthCalendar
          month={viewMonth}
          amountByDay={amountByDay}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
          onHoverDay={handleCalendarHover}
          lockedMonths={lockedMonths}
          lockedDays={lockedDays}
        />
      </div>

      {/* 右侧（2/3）：两张独立卡片上下排列 —— 上面是单独的农历黄历卡片，下面是按天支出趋势图
          （标题 = 当前时间范围，图表高 200px = 原来高度的约 2/3） */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* 农历黄历卡片（上，独立卡片）：悬停 / 选中日历某天即显示该天信息，默认今天。
            悬停状态在 LunarCard 内部自持，悬停只重渲染这张卡，折线图不受影响 */}
        <LunarCard selectedDay={selectedDay} hoverBridge={hoverBridgeRef} />

        {/* 折线图卡片（下） */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 bg-sky-100/90 rounded-full px-2.5 py-1">📈 支出趋势</span>
              <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
              {/* 图例：全天虚线 + 日常实线 */}
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-[#cbd5e1]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #cbd5e1 0 3px, transparent 3px 6px)' }} />
                  全天
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-[#6366f1] rounded" />
                  日常
                </span>
              </div>
            </div>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-primary"
            >
              <option value="">📊 全天</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <DailyDualLineChart data={filledDual} height={200} />
        </div>
      </div>
    </div>
  )
}
