// 金额筛选（记账列表）：纯函数，不依赖数据库 / React，可直接单测
//
// 三种条件（用户口语里的「单比」即「单笔」）：
//   day      = 按天：某天「支出合计」≥ 阈值 → 保留该天全部记录（合计口径与列表当天「合计」一致）
//   category = 大类：当前范围内某大类「支出合计」≥ 阈值 → 保留该大类全部记录
//   single   = 单笔：单条记录金额 ≥ 阈值 → 直接按记录过滤
//
// 说明：
// - 阈值只认 > 0（记录金额都是非负数，≥ 0 等于不筛选，所以 0 / 空 / 非法输入一律视为未启用）。
// - 按天 / 大类是「分组门槛」：统计基数 = 传进来的列表（即已叠加支付方式 / 日常 / 分类 / 搜索后的结果），
//   命中的分组整体保留，所以组合语义是「在已筛选结果里，再挑出金额够大的天 / 大类」。
// - 合计只统计计入支出的记录（与蓝色卡、列表当天合计口径一致），收入 / 不计类型不参与比较，
//   但命中的分组里这些记录照常显示（只是不影响是否达标）。
import type { Expense, TransactionType } from './types'

/** 金额筛选条件：按天（默认）/ 大类 / 单笔 */
export type AmountFilterMode = 'day' | 'category' | 'single'

/** 输入框原始文本 → 阈值；'' / 0 / 非法输入返回 null（= 不筛选） */
export function parseAmountThreshold(value: string): number | null {
  const num = parseFloat(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

/** 输入框净化：只保留数字 + 一个小数点，小数最多两位（金额筛选只认纯数字，不接受算式） */
export function sanitizeAmountInput(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '')
  const dot = v.indexOf('.')
  if (dot >= 0) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
    const [intPart, decPart] = v.split('.')
    v = intPart + '.' + (decPart ?? '').slice(0, 2)
  }
  return v
}

/**
 * 按金额筛选记录。
 * @param list         已叠加其它筛选的记录列表
 * @param mode         筛选条件
 * @param threshold    阈值（> 0；调用方用 parseAmountThreshold 保证）
 * @param isExpenseType 某收支类型是否「计入支出」（SettingsContext 的 expenseCodes）
 */
export function applyAmountFilter(
  list: Expense[],
  mode: AmountFilterMode,
  threshold: number,
  isExpenseType: (type: TransactionType) => boolean
): Expense[] {
  if (mode === 'single') {
    return list.filter((e) => e.amount >= threshold)
  }
  const keyOf = (e: Expense) => (mode === 'day' ? e.date : e.category_l1)
  const sums = new Map<string, number>()
  for (const e of list) {
    sums.set(keyOf(e), (sums.get(keyOf(e)) ?? 0) + (isExpenseType(e.type) ? e.amount : 0))
  }
  const hit = new Set(
    [...sums.entries()].filter(([, total]) => total >= threshold).map(([key]) => key)
  )
  return list.filter((e) => hit.has(keyOf(e)))
}
