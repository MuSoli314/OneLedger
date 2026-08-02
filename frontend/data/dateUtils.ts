// 本地日期工具（避免 toISOString 的 UTC 时区问题：凌晨 0-8 点日期会错一天）
import type { RangeMode } from './types'

/** 本地日期字符串，格式 YYYY-MM-DD */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地月份字符串，格式 YYYY-MM */
export function localMonthString(d: Date = new Date()): string {
  return localDateString(d).slice(0, 7)
}

/** 某个月的天数（month 格式 YYYY-MM） */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** 月份显示为 "2026年7月" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

/** 在本地日期上加减天数（返回新 Date，不修改入参） */
export function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

/** 生成 [start, end]（含两端）区间内所有日期，格式 YYYY-MM-DD */
export function eachDay(start: string, end: string): string[] {
  const result: string[] = []
  const cur = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  while (cur <= endDate) {
    result.push(localDateString(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

/** 计算时间范围的本地起止日期（近一周 / 近一月 / 本月 / 历史月份） */
export function getRangeDates(mode: RangeMode, historyMonth?: string): { start: string; end: string } {
  const now = new Date()
  if (mode === 'week') {
    // 近一周 = 今天往前推 6 天 → 今天（共 7 天）
    return { start: localDateString(addDays(now, -6)), end: localDateString(now) }
  }
  if (mode === '30d') {
    // 近一月 = 今天往前推 29 天 → 今天（共 30 天）
    return { start: localDateString(addDays(now, -29)), end: localDateString(now) }
  }
  if (mode === 'month') {
    // 本月 = 自然月 1 号 → 今天
    return { start: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)), end: localDateString(now) }
  }
  // history：所选自然月的 1 号 → 最后一天
  const hm = historyMonth || localMonthString()
  const lastDay = new Date(Number(hm.slice(0, 4)), Number(hm.slice(5, 7)), 0).getDate()
  return { start: `${hm}-01`, end: `${hm}-${String(lastDay).padStart(2, '0')}` }
}
