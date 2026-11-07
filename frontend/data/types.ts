// 类型定义

// 内置收支类型代号（兜底用，与旧数据兼容）
export const BUILTIN_TX_CODES = ['expense', 'income', 'ignore'] as const
export type BuiltinTxCode = (typeof BUILTIN_TX_CODES)[number]

// 收支类型：记录里存的是内部代号 code（可能是自定义的 t_<id>），故放宽为 string
export type TransactionType = string

// 收支类型的统计归属
export type TxCategory = 'expense' | 'income' | 'ignore'

// 收支类型配置（来自 tx_types 表）
export interface TxTypeConfig {
  id: number
  code: string
  name: string
  icon: string
  category: TxCategory
}

// 支付方式配置（来自 payment_methods 表）
export interface PaymentMethodConfig {
  id: number
  name: string
  icon: string
}

// 时间范围模式：近一周 / 近一月 / 本月 / 上月 / 历史月份 / 自定义
export type RangeMode = 'week' | '30d' | 'month' | 'lastMonth' | 'history' | 'custom'

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
  is_non_daily: boolean
}

export interface ExpenseInput {
  amount: number
  category_l1: string
  category_l2: string
  date: string
  note: string
  payment_method: string
  type: TransactionType
  is_non_daily?: boolean
}

export interface MonthlyStats {
  total: number
  count: number
  byCategory: {
    category_l1: string
    total: number
    count: number
    children: { category_l2: string; total: number; count: number }[]
  }[]
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

// 按天的支出聚合点（右栏当月支出图）
export interface DailyTrendPoint {
  date: string
  total: number
}

// 按天支出聚合点（右栏当月支出图数据源：日常/非日常拆分，全天=二者之和）
export interface DailyNonDailyPoint {
  date: string
  dailyTotal: number
  nonDailyTotal: number
}

// 数据库中的分类（带 id）
export interface CategoryRecord {
  id: number
  name: string
  icon: string
  sort_order: number
  is_default: boolean
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
  default_is_non_daily: number
}

// 子分类的树形结构（含默认值模板）
export interface SubCategoryChild {
  id: number
  name: string
  is_default: boolean
  default_note: string
  default_payment_method: string
  default_amount: number
  default_type: TransactionType
  default_is_non_daily: boolean
}

// ===== 小类条件规则（subcategory_rules 表） =====

/**
 * 规则条件种类：
 * - workday 工作日（含法定节假日与调休补班）/ rest 休息日
 * - weekday 每周星期几（days: 1=周一 … 7=周日，多选 = 或）
 * - monthday 每月第几天（days: 1–31，多选 = 或）
 * - annual 每年某月某日（month + day）
 */
export type RuleConditionKind = 'workday' | 'rest' | 'weekday' | 'monthday' | 'annual'

export interface RuleCondition {
  kind: RuleConditionKind
  /** weekday: 1–7；monthday: 1–31 */
  days?: number[]
  /** annual: 1–12 */
  month?: number
  /** annual: 1–31 */
  day?: number
}

/** 一条小类条件规则：启用勾选 + 条件 + 金额（其余属性永远取小类主行） */
export interface SubcategoryRule {
  id: number
  subcategory_id: number
  /** 顺序 = 优先级，小的先匹配 */
  sort_order: number
  /** false = 勾掉了，匹配时跳过（规则保留） */
  enabled: boolean
  /** 空数组 = 「总是」（匹配所有日期） */
  conditions: RuleCondition[]
  amount: number
}

// 前端使用的分类树（含子分类的完整结构）
export interface CategoryWithChildren {
  id: number
  name: string
  icon: string
  /** 大类是否参与「添加某天」自动记账（勾选后，其下默认小类才会被自动添加） */
  is_default: boolean
  children: SubCategoryChild[]
}
