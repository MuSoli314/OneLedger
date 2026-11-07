// 节假日数据 —— 内置数据导入 + 联网抓取 + 节流规则（纯逻辑，不碰数据库）
//
// 数据源（设计文档第 8 节）：holiday-cn 静态 JSON，该仓库每天自动抓取国务院公告。
//   https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json
//   { year, papers: [...], days: [{ name, date, isOffDay }] }
//   isOffDay: true = 放假；isOffDay: false = 调休补班（要上班）
//
// 表里只存「特殊日期」，缺省就按周一~周五判断 —— 所以「该年没数据」和「该年确实没有特殊日期」
// 走同一条判定路径，不需要额外分支。
import { HolidayUtil } from 'lunar-javascript'

/** 一天的节假日信息（表里只存放假 / 补班这类特殊日期） */
export interface HolidayDay {
  /** YYYY-MM-DD */
  date: string
  year: number
  /** 节日名（如「国庆节」「春节」） */
  name: string
  /** true = 放假；false = 调休补班 */
  isOffDay: boolean
}

/** 依赖库 lunar-javascript 内置数据的第一年（2001 年之前没有完整调休安排） */
export const BUILTIN_FIRST_YEAR = 2001

/** 同一年最多每 24 小时联网检查一次 */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 次年的安排只在 10 月起才可能有（国务院一般 10–12 月一次性公布） */
export const NEXT_YEAR_CHECK_FROM_MONTH = 10

/** 单次启动最多检查几个年份（避免首启时串行等太久） */
export const MAX_YEARS_PER_RUN = 4

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * 把依赖库内置的法定节假日/调休安排收集成表里的行。
 * 只取「特殊日期」：放假 + 补班；普通周末在判定时按周一~周五推出，不入表。
 */
export function collectBuiltinHolidayDays(fromYear: number, toYear: number): HolidayDay[] {
  const out: HolidayDay[] = []
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = new Date(y, m, 0).getDate()
      for (let d = 1; d <= daysInMonth; d++) {
        const holiday = HolidayUtil.getHoliday(y, m, d)
        if (!holiday) continue
        out.push({
          date: `${y}-${pad2(m)}-${pad2(d)}`,
          year: y,
          name: holiday.getName(),
          isOffDay: !holiday.isWork(),
        })
      }
    }
  }
  return out
}

export function holidaySourceUrl(year: number): string {
  return `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`
}

export interface FetchHolidayYearResult {
  /** 网络请求 + JSON 解析是否成功 */
  ok: boolean
  /** 该年安排是否已公布（已公布才标记为「就绪」） */
  published: boolean
  days: HolidayDay[]
  error?: string
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * 抓某一年的放假安排。
 * 永不抛异常：失败一律返回 ok=false（联网失败不能阻塞任何记账功能，设计文档 8.5）。
 */
export async function fetchHolidayYear(year: number, timeoutMs = 8000): Promise<FetchHolidayYearResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(holidaySourceUrl(year), { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return { ok: false, published: false, days: [], error: `HTTP ${res.status}` }
    const raw: unknown = await res.json()
    const rawDays = (raw as { days?: unknown })?.days
    const days: HolidayDay[] = []
    if (Array.isArray(rawDays)) {
      for (const item of rawDays) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        if (!isValidIsoDate(obj.date)) continue
        // 只收该年的日期（数据源里偶尔混进相邻年的补班日，这里挡一道）
        if (!obj.date.startsWith(String(year))) continue
        days.push({
          date: obj.date,
          year,
          name: typeof obj.name === 'string' ? obj.name : '',
          isOffDay: obj.isOffDay === true,
        })
      }
    }
    return { ok: true, published: days.length > 0, days }
  } catch (err) {
    return { ok: false, published: false, days: [], error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

/** 该年份是否到了可以再联网检查的时候（lastCheckedAt 为 null = 从没检查过） */
export function shouldCheckYear(lastCheckedAt: string | null, nowMs: number, force: boolean): boolean {
  if (force) return true
  if (!lastCheckedAt) return true
  const last = new Date(lastCheckedAt).getTime()
  if (!Number.isFinite(last)) return true
  return nowMs - last >= CHECK_INTERVAL_MS
}

export interface FetchTargetArgs {
  currentYear: number
  /** 1–12 */
  currentMonth: number
  /** 该年数据是否已就绪 */
  isReady: (year: number) => boolean
  /** 最后一个已就绪的年份；一年都没有则为 null */
  lastReadyYear: number | null
}

/**
 * 算出这次启动该去试哪些年份（设计文档 8.4）：
 * - 当年：只要未就绪就一直试（全年有效，保证缺口能补上）；
 * - 次年：只在 10 月起才试；
 * - 从「最后一个就绪年份 + 1」开始往后补；
 * - 单次最多 MAX_YEARS_PER_RUN 个年份。
 */
export function holidayFetchTargets(args: FetchTargetArgs): number[] {
  const { currentYear, currentMonth, isReady, lastReadyYear } = args
  const maxYear = currentMonth >= NEXT_YEAR_CHECK_FROM_MONTH ? currentYear + 1 : currentYear
  // 起点：最后一个就绪年份的下一年；一年都没就绪就从当年开始（不追溯内置数据之前）
  const start = lastReadyYear !== null ? lastReadyYear + 1 : currentYear
  const targets: number[] = []
  for (let year = Math.max(start, BUILTIN_FIRST_YEAR); year <= maxYear; year++) {
    if (year < BUILTIN_FIRST_YEAR) continue
    if (isReady(year)) continue
    targets.push(year)
    if (targets.length >= MAX_YEARS_PER_RUN) break
  }
  // 当年若还没就绪，必须排在候选里（即使起点比它大，如下一年已就绪而当年缺数据）
  if (!isReady(currentYear) && !targets.includes(currentYear) && targets.length < MAX_YEARS_PER_RUN) {
    targets.unshift(currentYear)
  }
  return targets
}
