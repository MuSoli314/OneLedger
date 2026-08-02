// 本地日期工具（避免 toISOString 的 UTC 时区问题：凌晨 0-8 点日期会错一天）

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
