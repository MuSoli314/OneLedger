// 农历黄历卡片：显示某天的干支年月日 + 宜/忌。显示优先级：悬停日历某天 → 选中某天 → 默认今天。
// 悬停状态（hoverDay）放在本卡片内部，而不是 MonthOverview —— 这样鼠标划过日历格子时
// 只有这张卡重渲染，右侧折线图完全不受影响（修复：悬停日历导致折线图反复重渲染/重放动画）。
// 日历在左列、本卡在右列，两者是兄弟节点，跨列传悬停事件通过父组件持有的 hoverBridge ref 直达：
// MonthOverview 把 onHoverDay 接成稳定回调 → hoverBridge.current.setHoverDay(day) → 本卡内部 setState。
import { useEffect, useMemo, useRef, useState } from 'react'
import { localDateString } from '../data/dateUtils'
import { getDayLunarInfo } from '../data/lunarUtils'

/** 悬停桥：父组件（MonthOverview）持有的 ref，日历的悬停事件经它直达本卡片内部的 setter */
export interface LunarHoverBridge {
  setHoverDay: (day: string | null) => void
}

/** 宜/忌单行：事项固定一行展示，超长省略号截断（不再换行导致卡片高度变化）；
 *  仅当文字真的被截断时，悬浮该行弹出深色气泡显示完整内容（原生 title 在 Tauri WebView 不显示） */
function YiJiRow({ label, items, badgeClassName, textClassName }: {
  label: string
  items: string[]
  badgeClassName: string
  textClassName: string
}) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [truncated, setTruncated] = useState(false)

  // 检测是否被截断：容器变窄 / 换天后文字变化都会重新检测
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items])

  const full = items.join('、')
  return (
    <div className="relative group flex items-center gap-2.5">
      <span className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-bold ${badgeClassName}`}>{label}</span>
      <p ref={textRef} className={`min-w-0 flex-1 text-sm leading-relaxed truncate ${textClassName}`}>{full}</p>
      {truncated && (
        <div className="pointer-events-none absolute left-8 top-full mt-1.5 z-20 hidden group-hover:block max-w-md bg-slate-800/95 text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-lg whitespace-normal">
          {full}
        </div>
      )}
    </div>
  )
}

interface Props {
  /** 当前选中的日期（null = 未选中） */
  selectedDay: string | null
  /** 悬停桥 ref（由 MonthOverview 创建并传入） */
  hoverBridge: { current: LunarHoverBridge | null }
}

export default function LunarCard({ selectedDay, hoverBridge }: Props) {
  const [hoverDay, setHoverDay] = useState<string | null>(null)

  // 把内部 setter 暴露给父组件；卸载时清空，避免残留引用
  useEffect(() => {
    hoverBridge.current = { setHoverDay }
    return () => {
      hoverBridge.current = null
    }
  }, [hoverBridge, setHoverDay])

  // 黄历面板显示的天：悬停某天优先 → 选中某天 → 默认今天
  const todayStr = localDateString()
  const lunarDay = hoverDay ?? selectedDay ?? todayStr
  const lunarInfo = useMemo(() => getDayLunarInfo(lunarDay), [lunarDay])
  const [lm, ld] = lunarDay.split('-').slice(1)
  const solarLabel = `${Number(lm)}月${Number(ld)}日` // 副标题里的公历日期（如 8月16日）

  return (
    <div className="flex-1 bg-gradient-to-b from-amber-50 to-amber-100/60 border-amber-200/70 rounded-2xl border shadow-sm p-5 flex flex-col justify-center">
      {/* 第一行：黄历标签（左）+ 干支年月日（居中）+ 公历/农历日期（右） */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-amber-700 bg-amber-100/90 rounded-full px-2.5 py-1">
          📜 黄历
        </span>
        <span className="flex-1 min-w-0 text-center text-base font-bold text-slate-800 tracking-wide">
          {lunarInfo.year}年 {lunarInfo.month}月 {lunarInfo.day}日
        </span>
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          {solarLabel}{lunarDay === todayStr ? ' · 今天' : ''} · 农历{lunarInfo.lunarDate}
        </span>
      </div>

      {/* 宜 / 忌：徽标行（固定一行，超长截断 + 悬浮完整气泡） */}
      <div className="mt-2.5 space-y-1.5">
        {lunarInfo.yi.length > 0 && (
          <YiJiRow label="宜" items={lunarInfo.yi} badgeClassName="bg-red-100 text-red-600" textClassName="text-slate-700" />
        )}
        {lunarInfo.ji.length > 0 && (
          <YiJiRow label="忌" items={lunarInfo.ji} badgeClassName="bg-slate-200 text-slate-500" textClassName="text-slate-500" />
        )}
      </div>
    </div>
  )
}
