// 小类条件规则 —— 条件模型 + 纯匹配逻辑
//
// 本文件**不依赖数据库、不依赖 React、不依赖 date-fns**，只做「条件 + 日期 → 命中与否」的纯计算，
// 便于单独验证（见设计文档第 9 节第 1 步）。
//
// 语义（设计文档 5.1 / 6.2）：
//   · 条件为空数组            = 「总是」，匹配所有日期
//   · 同一种 kind 的多个值    = 「或」（每周一、周三 → 任一天命中即可）
//   · 不同 kind 之间          = 「且」（工作日 且 每月 1 号 → 两个都要满足）
//   · 不认识的 kind / 缺参数的脏数据 → 忽略该条（不因脏数据把规则判成永不命中）

import type { RuleCondition, RuleConditionKind, SubcategoryRule } from './types'

/** 星期几的中文全称，下标 1–7 = 周一–周日 */
export const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 星期几的短标签（界面上的七个小格子），下标 1–7 = 周一–周日 */
export const WEEKDAY_SHORT = ['', '一', '二', '三', '四', '五', '六', '日']

const KINDS: RuleConditionKind[] = ['workday', 'rest', 'weekday', 'monthday', 'annual']

function isKind(value: unknown): value is RuleConditionKind {
  return typeof value === 'string' && (KINDS as string[]).includes(value)
}

function toInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

/** 解析条件 JSON 文本；任何异常都退化成空数组（= 总是），绝不让脏数据把规则弄失效 */
export function parseConditions(text: string | null | undefined): RuleCondition[] {
  if (!text) return []
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const out: RuleCondition[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (!isKind(obj.kind)) continue
    const kind = obj.kind
    if (kind === 'workday' || kind === 'rest') {
      out.push({ kind })
    } else if (kind === 'weekday') {
      const days = Array.isArray(obj.days)
        ? obj.days.map(toInt).filter((d): d is number => d !== undefined && d >= 1 && d <= 7)
        : []
      if (days.length > 0) out.push({ kind, days })
    } else if (kind === 'monthday') {
      const days = Array.isArray(obj.days)
        ? obj.days.map(toInt).filter((d): d is number => d !== undefined && d >= 1 && d <= 31)
        : []
      if (days.length > 0) out.push({ kind, days })
    } else {
      const month = toInt(obj.month)
      const day = toInt(obj.day)
      if (month !== undefined && day !== undefined && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        out.push({ kind, month, day })
      }
    }
  }
  return out
}

/** 序列化成入库用的 JSON 文本 */
export function serializeConditions(conditions: RuleCondition[]): string {
  return JSON.stringify(conditions)
}

/** 条件为空 = 「总是」（无语义上的兜底功能，就是一条普通规则） */
export function isAlwaysRule(conditions: RuleCondition[]): boolean {
  return conditions.length === 0
}

/** 把 YYYY-MM-DD 按**本地时间**拆成 年/月/日 + 星期（1=周一 … 7=周日），不走 Date 字符串解析以免 UTC 错一天 */
export function splitLocalDate(date: string): { year: number; month: number; day: number; isoWeekday: number } {
  const [y, m, d] = date.split('-').map((v) => Number(v))
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const jsDay = dt.getDay() // 0=周日 … 6=周六
  return {
    year: y,
    month: m,
    day: d,
    isoWeekday: jsDay === 0 ? 7 : jsDay,
  }
}

/**
 * 工作日判定的**退化逻辑**：只按周一~周五算
 * （节假日数据表就绪后由 database.ts 换成带法定节假日/调休的版本；该年数据缺失时也退化成这个）
 */
export function fallbackIsWorkday(date: string): boolean {
  const { isoWeekday } = splitLocalDate(date)
  return isoWeekday <= 5
}

/**
 * 单条规则的条件是否命中某天。
 * isWorkday 由调用方注入（数据库层会传入节假日数据版的判定）。
 */
export function conditionsMatch(
  conditions: RuleCondition[],
  date: string,
  isWorkday: (date: string) => boolean = fallbackIsWorkday
): boolean {
  if (conditions.length === 0) return true // 总是

  const { year, month, day, isoWeekday } = splitLocalDate(date)
  if (!year || !month || !day) return false

  // 按 kind 分组：同一个 kind 的多个条目 = 「或」；不同 kind 之间 = 「且」
  const groups = new Map<RuleConditionKind, RuleCondition[]>()
  for (const c of conditions) {
    const list = groups.get(c.kind)
    if (list) list.push(c)
    else groups.set(c.kind, [c])
  }

  for (const [kind, list] of groups) {
    const hit = list.some((c) => {
      switch (kind) {
        case 'workday':
          return isWorkday(date)
        case 'rest':
          return !isWorkday(date)
        case 'weekday':
          return (c.days ?? []).includes(isoWeekday)
        case 'monthday':
          return (c.days ?? []).includes(day)
        case 'annual':
          return c.month === month && c.day === day
      }
    })
    if (!hit) return false
  }
  return true
}

/**
 * 按顺序匹配一组规则：跳过 enabled=false 的，返回第一条命中的金额；一条都没命中返回 null。
 * @param rules 必须已按 sort_order 升序（顺序 = 优先级）
 */
export function matchRulesAmount(
  rules: Pick<SubcategoryRule, 'enabled' | 'conditions' | 'amount'>[],
  date: string,
  isWorkday: (date: string) => boolean = fallbackIsWorkday
): number | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (conditionsMatch(rule.conditions, date, isWorkday)) return rule.amount
  }
  return null
}

/** 条件的中文标签（界面上的条件格、以及并排显示的多条条件） */
export function describeCondition(c: RuleCondition): string {
  switch (c.kind) {
    case 'workday':
      return '工作日'
    case 'rest':
      return '休息日'
    case 'weekday': {
      const days = c.days ?? []
      if (days.length === 7) return '每天'
      const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]).join('、')
      return `每${names}`
    }
    case 'monthday': {
      const days = [...(c.days ?? [])].sort((a, b) => a - b)
      return `每月 ${days.join('、')} 号`
    }
    case 'annual':
      return `每年 ${c.month} 月 ${c.day} 日`
  }
}

/** 整条规则的条件描述；空条件 → 「总是」 */
export function describeConditions(conditions: RuleCondition[]): string {
  if (conditions.length === 0) return '总是'
  return conditions.map(describeCondition).join(' 且 ')
}
