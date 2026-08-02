// 类型定义
export type TransactionType = 'expense' | 'income' | 'ignore'

export interface Expense {
  id: number
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note: string
  payment_method: string
  type: TransactionType
  created_at: string
}

export interface ExpenseInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note: string
  payment_method: string
  type: TransactionType
}

export interface MonthlyStats {
  total: number
  count: number
  byCategory: { category_l1: string; total: number; count: number }[]
}

export interface Budget {
  id: number
  month: string
  amount: number
}

export interface TrendPoint {
  month: string
  total: number
}

// 数据库中的分类（带 id）
export interface CategoryRecord {
  id: number
  name: string
  icon: string
  sort_order: number
}

// 数据库中的子分类
export interface SubCategoryRecord {
  id: number
  category_id: number
  name: string
  is_default: boolean
  sort_order: number
  default_note: string
  default_payment_method: string
  default_amount: number
  default_type: TransactionType
}

// 子分类的树形结构（含默认值模板）
export interface SubCategoryChild {
  id: number
  name: string
  isDefault: boolean
  defaultNote: string
  defaultPaymentMethod: string
  defaultAmount: number
  defaultType: TransactionType
}

// 前端使用的分类树（含子分类的完整结构）
export interface CategoryWithChildren {
  id: number
  name: string
  icon: string
  children: SubCategoryChild[]
}
