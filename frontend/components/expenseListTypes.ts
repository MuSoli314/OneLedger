// 记账列表（ExpenseList）专用类型
import type { TransactionType } from '../data/types'

/** 本地未入库的临时行（id 为负数 tempId，保存成功后才真正写入数据库） */
export interface LocalRow {
  tempId: number
  date: string
  category_l1: string
  category_l2: string
  note: string
  amount: number
  payment_method: string
  type: TransactionType
  is_non_daily: boolean
}

/** 行内编辑可聚焦的字段 */
export type EditField = 'category_l2' | 'amount' | 'payment_method' | 'type' | 'note'

/** 行内编辑表单（字符串形态，保存时再解析/校验） */
export interface EditForm {
  category_l2: string
  note: string
  amount: string
  payment_method: string
  type: TransactionType
  is_non_daily: boolean
}
