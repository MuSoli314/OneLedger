import Database from '@tauri-apps/plugin-sql'
import type { Expense, ExpenseInput, Budget, TrendPoint, CategoryWithChildren, TransactionType, DailyTrendPoint, MonthlyStats, PaymentMethodConfig, TxTypeConfig, TxCategory } from './types'
import { categories as defaultCategories, DEFAULT_PAYMENT_METHODS, DEFAULT_TX_TYPES } from './categories'

// 分类筛选的组合键分隔符（小类名在不同大类下可能重名，故用「大类+小类」作唯一键）
// HomePage / StatsPanel / database 共用此函数，保证键格式一致
export const CAT_KEY_SEP = '§'
export const catKey = (l1: string, l2: string) => `${l1}${CAT_KEY_SEP}${l2}`

let db: Database | null = null
let dbInit: Promise<Database> | null = null

async function getDb(): Promise<Database> {
  if (db) return db
  if (!dbInit) {
    dbInit = connectDb()
  }
  return dbInit
}

/** 尝试连接数据库，失败时自动重试 */
async function connectDb(retries = 2): Promise<Database> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const conn = await Database.load('sqlite:one_ledger.db')

      // 确保消费记录表存在（含 payment_method 和 type 字段）
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, category_l1 TEXT NOT NULL, category_l2 TEXT NOT NULL, date TEXT NOT NULL, note TEXT DEFAULT "", payment_method TEXT DEFAULT "", type TEXT DEFAULT "expense", created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
      )

      // 兼容旧数据库：尝试添加 payment_method 列（已存在则忽略）
      try {
        await conn.execute('ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT ""')
      } catch {
        // 列已存在，忽略
      }

      // 兼容旧数据库：尝试添加 type 列（已存在则忽略）
      try {
        await conn.execute('ALTER TABLE expenses ADD COLUMN type TEXT DEFAULT "expense"')
      } catch {
        // 列已存在，忽略
      }

      // 分类表
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL DEFAULT "📂", sort_order INTEGER NOT NULL DEFAULT 0)'
      )
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS subcategories (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE)'
      )

      // 迁移：给子分类添加默认备注/支付方式/金额/类型字段
      for (const col of ['default_note TEXT DEFAULT ""', 'default_payment_method TEXT DEFAULT ""', 'default_amount REAL DEFAULT 0', 'default_type TEXT DEFAULT "expense"']) {
        try {
          await conn.execute(`ALTER TABLE subcategories ADD COLUMN ${col}`)
        } catch { /* 列已存在，忽略 */ }
      }

      // 检查是否需要播种默认分类
      const catCount = await conn.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM categories')
      if (catCount[0]?.cnt === 0) {
        for (let i = 0; i < defaultCategories.length; i++) {
          const cat = defaultCategories[i]
          const result = await conn.execute(
            'INSERT INTO categories (name, icon, sort_order) VALUES ($1, $2, $3)',
            [cat.name, cat.icon, i]
          )
          const catId = result.lastInsertId as number
          for (let j = 0; j < cat.children.length; j++) {
            await conn.execute(
              'INSERT INTO subcategories (category_id, name, is_default, sort_order) VALUES ($1, $2, 0, $3)',
              [catId, cat.children[j].name, j]
            )
          }
        }
      }

      // 确保预算表存在
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT NOT NULL UNIQUE, amount REAL NOT NULL DEFAULT 0)'
      )

      // 支付方式表（记录里存的是 name，改名时同步迁移历史记录）
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL DEFAULT "💳", sort_order INTEGER NOT NULL DEFAULT 0)'
      )
      // 收支类型表（记录里存的是 code，改名无需迁移）
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS tx_types (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT "💰", category TEXT NOT NULL DEFAULT "expense", sort_order INTEGER NOT NULL DEFAULT 0)'
      )

      // 播种默认支付方式
      const pmCount = await conn.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM payment_methods')
      if (pmCount[0]?.cnt === 0) {
        for (let i = 0; i < DEFAULT_PAYMENT_METHODS.length; i++) {
          await conn.execute(
            'INSERT INTO payment_methods (name, icon, sort_order) VALUES ($1, $2, $3)',
            [DEFAULT_PAYMENT_METHODS[i].name, DEFAULT_PAYMENT_METHODS[i].icon, i]
          )
        }
      }

      // 播种默认收支类型
      const ttCount = await conn.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM tx_types')
      if (ttCount[0]?.cnt === 0) {
        for (let i = 0; i < DEFAULT_TX_TYPES.length; i++) {
          await conn.execute(
            'INSERT INTO tx_types (code, name, icon, category, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [DEFAULT_TX_TYPES[i].value, DEFAULT_TX_TYPES[i].name, DEFAULT_TX_TYPES[i].icon, DEFAULT_TX_TYPES[i].category, i]
          )
        }
      }
      db = conn
      return conn
    } catch (err) {
      if (attempt < retries) {
        // 等 300ms 后重试（给 Tauri 后端插件初始化时间）
        await new Promise((r) => setTimeout(r, 300))
      } else {
        // 所有重试都失败，重置以便后续调用再试
        dbInit = null
        throw err
      }
    }
  }
  throw new Error('数据库连接失败')
}

// 添加一条消费记录
export async function addExpense(input: ExpenseInput): Promise<number> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO expenses (amount, category_l1, category_l2, date, note, payment_method, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [input.amount, input.category_l1, input.category_l2, input.date, input.note, input.payment_method || '', input.type || 'expense']
  )
  return result.lastInsertId as number
}

// 更新一条消费记录
export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const database = await getDb()
  await database.execute(
    'UPDATE expenses SET amount=$1, category_l1=$2, category_l2=$3, date=$4, note=$5, payment_method=$6, type=$7 WHERE id=$8',
    [input.amount, input.category_l1, input.category_l2, input.date, input.note, input.payment_method || '', input.type || 'expense', id]
  )
}

// 删除一条消费记录
export async function deleteExpense(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM expenses WHERE id=$1', [id])
}

// 删除某一天的所有消费记录
export async function deleteExpensesByDate(date: string): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM expenses WHERE date=$1', [date])
}

// 删除某一天某个大类的所有消费记录
export async function deleteExpensesByCategory(date: string, category_l1: string): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM expenses WHERE date=$1 AND category_l1=$2', [date, category_l1])
}

// 查询消费记录列表
// 注意：不传 limit 时默认取 10000 条（避免记录多时被悄悄截断）
export async function listExpenses(params?: {
  month?: string // 格式: YYYY-MM
  startDate?: string // 格式: YYYY-MM-DD（含当天）
  endDate?: string // 格式: YYYY-MM-DD（含当天）
  category_l1?: string
  keyword?: string
  limit?: number
  offset?: number
}): Promise<Expense[]> {
  const database = await getDb()
  const conditions: string[] = []
  const values: (string | number)[] = []
  let idx = 1

  if (params?.month) {
    conditions.push(`strftime('%Y-%m', date)=$${idx}`)
    values.push(params.month)
    idx++
  }
  if (params?.startDate) {
    conditions.push(`date >= $${idx}`)
    values.push(params.startDate)
    idx++
  }
  if (params?.endDate) {
    conditions.push(`date <= $${idx}`)
    values.push(params.endDate)
    idx++
  }
  if (params?.category_l1) {
    conditions.push(`category_l1=$${idx}`)
    values.push(params.category_l1)
    idx++
  }
  if (params?.keyword) {
    conditions.push(`note LIKE $${idx}`)
    values.push(`%${params.keyword}%`)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params?.limit ?? 10000
  const offset = params?.offset ?? 0

  const sql = `SELECT * FROM expenses ${where} ORDER BY date DESC, id ASC LIMIT $${idx} OFFSET $${idx + 1}`
  return database.select<Expense[]>(sql, [...values, limit, offset])
}

// 获取所有记录（用于导出）
export async function getAllExpenses(): Promise<Expense[]> {
  const database = await getDb()
  return database.select<Expense[]>('SELECT * FROM expenses ORDER BY date DESC, id ASC')
}

// 按日期范围的每日支出聚合（右栏「当月支出」图；categoryL1 传值则只看该大类）
export async function getDailyTotals(startDate: string, endDate: string, categoryL1?: string): Promise<DailyTrendPoint[]> {
  const database = await getDb()
  const conditions = ['date >= $1', 'date <= $2', "type IN (SELECT code FROM tx_types WHERE category='expense')"]
  const values: string[] = [startDate, endDate]
  if (categoryL1) {
    conditions.push('category_l1=$3')
    values.push(categoryL1)
  }
  const sql = `SELECT date, SUM(amount) as total FROM expenses WHERE ${conditions.join(' AND ')} GROUP BY date ORDER BY date ASC`
  return database.select<DailyTrendPoint[]>(sql, values)
}

// 按日期范围的分类排行（替代 getMonthlyStats 的月份版本）。
// 每个大类附带 children（小类聚合），供分类排行展开查看小类金额。
// 排行始终统计完整范围内的数据（作为勾选筛选的入口，勾选后只筛选记录列表）。
export async function getStatsByRange(startDate: string, endDate: string): Promise<MonthlyStats> {
  const database = await getDb()
  const summary = await database.select<{ total: number; count: number }[]>(
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= $1 AND date <= $2 AND type IN (SELECT code FROM tx_types WHERE category='expense')",
    [startDate, endDate]
  )
  const byCategory = await database.select<MonthlyStats['byCategory']>(
    "SELECT category_l1, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date >= $1 AND date <= $2 AND type IN (SELECT code FROM tx_types WHERE category='expense') GROUP BY category_l1 ORDER BY total DESC",
    [startDate, endDate]
  )
  // 小类聚合：按大类+小类分组，同一大类下按金额从高到低排序
  const byL2 = await database.select<
    { category_l1: string; category_l2: string; total: number; count: number }[]
  >(
    "SELECT category_l1, category_l2, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date >= $1 AND date <= $2 AND type IN (SELECT code FROM tx_types WHERE category='expense') GROUP BY category_l1, category_l2 ORDER BY category_l1 ASC, total DESC",
    [startDate, endDate]
  )
  const childrenByL1 = new Map<string, MonthlyStats['byCategory'][number]['children']>()
  for (const row of byL2) {
    const list = childrenByL1.get(row.category_l1) ?? []
    list.push({ category_l2: row.category_l2, total: row.total, count: row.count })
    childrenByL1.set(row.category_l1, list)
  }
  for (const item of byCategory) {
    item.children = childrenByL1.get(item.category_l1) ?? []
  }
  return {
    total: summary[0]?.total ?? 0,
    count: summary[0]?.count ?? 0,
    byCategory,
  }
}

// 获取所有有记录的月份列表
export async function getMonths(): Promise<string[]> {
  const database = await getDb()
  const rows = await database.select<{ month: string }[]>(
    "SELECT strftime('%Y-%m', date) as month FROM expenses GROUP BY month ORDER BY month DESC"
  )
  return rows.map((r) => r.month)
}

// ========== 趋势数据 ==========

// 获取过去 N 个月的月度支出趋势（categoryL1 传值则只看该大类）
export async function getTrendData(months: number = 12, categoryL1?: string): Promise<TrendPoint[]> {
  const database = await getDb()
  const n = Math.max(1, Math.floor(months))
  const rows = await database.select<TrendPoint[]>(
    `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
     FROM expenses
     WHERE date >= date('now', 'localtime', '-' || CAST($1 AS TEXT) || ' months', 'start of month')
       AND type IN (SELECT code FROM tx_types WHERE category='expense')
       ${categoryL1 ? `AND category_l1 = $2` : ''}
     GROUP BY month ORDER BY month ASC`,
    categoryL1 ? [n, categoryL1] : [n]
  )
  return rows
}

// ========== 预算功能 ==========

// 获取某个月的预算
export async function getBudget(month: string): Promise<Budget | null> {
  const database = await getDb()
  const rows = await database.select<Budget[]>(
    'SELECT * FROM budgets WHERE month=$1 LIMIT 1',
    [month]
  )
  return rows[0] || null
}

// 设置/更新预算
export async function setBudget(month: string, amount: number): Promise<void> {
  const database = await getDb()
  const existing = await database.select<Budget[]>(
    'SELECT * FROM budgets WHERE month=$1 LIMIT 1',
    [month]
  )
  if (existing.length > 0) {
    await database.execute('UPDATE budgets SET amount=$1 WHERE month=$2', [amount, month])
  } else {
    await database.execute('INSERT INTO budgets (month, amount) VALUES ($1, $2)', [month, amount])
  }
}

// 删除某月预算记录（预算置为未设置）
export async function deleteBudget(month: string): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM budgets WHERE month=$1', [month])
}

// ========== 数据导出 ==========

// CSV 字段转义：含逗号/引号/换行的字段用双引号包裹，内部引号双写
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function expensesToCSV(expenses: Expense[], txTypes: TxTypeConfig[]): string {
  const headers = ['日期', '一级分类', '二级分类', '金额(元)', '支付方式', '备注', '收支类型']
  const typeMap = new Map(txTypes.map((t) => [t.code, t.name]))
  const rows = expenses.map((e) =>
    [e.date, e.category_l1, e.category_l2, e.amount.toFixed(2), e.payment_method, e.note, typeMap.get(e.type) || '未定义']
      .map(csvField)
      .join(',')
  )
  // ﻿ BOM 头，让 Excel 正确识别 UTF-8 中文
  return '\uFEFF' + [headers.map(csvField).join(','), ...rows].join('\n')
}

// ========== 分类管理 ==========

// 获取所有分类（含子分类，树形结构）
export async function getCategories(): Promise<CategoryWithChildren[]> {
  const database = await getDb()
  const catRows = await database.select<
    { id: number; name: string; icon: string; sort_order: number }[]
  >('SELECT * FROM categories ORDER BY sort_order ASC, id ASC')

  const subRows = await database.select<
    { id: number; category_id: number; name: string; is_default: number; default_note: string; default_payment_method: string; default_amount: number; default_type: string; sort_order: number }[]
  >('SELECT id, category_id, name, is_default, default_note, default_payment_method, default_amount, default_type, sort_order FROM subcategories ORDER BY sort_order ASC, id ASC')

  const subMap: Record<number, { id: number; name: string; isDefault: boolean; defaultNote: string; defaultPaymentMethod: string; defaultAmount: number; defaultType: TransactionType }[]> = {}
  for (const s of subRows) {
    if (!subMap[s.category_id]) subMap[s.category_id] = []
    subMap[s.category_id].push({ id: s.id, name: s.name, isDefault: s.is_default === 1, defaultNote: s.default_note || '', defaultPaymentMethod: s.default_payment_method || '', defaultAmount: s.default_amount || 0, defaultType: (s.default_type as TransactionType) || 'expense' })
  }

  return catRows.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    children: subMap[c.id] || [],
  }))
}

// 新增大类
export async function addCategory(name: string, icon: string): Promise<number> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO categories (name, icon, sort_order) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories))',
    [name, icon]
  )
  return result.lastInsertId as number
}

// 删除大类（级联删除所有子分类）
export async function deleteCategory(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM subcategories WHERE category_id=$1', [id])
  await database.execute('DELETE FROM categories WHERE id=$1', [id])
}

// 更新大类名称
export async function updateCategoryName(id: number, name: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE categories SET name=$1 WHERE id=$2', [name, id])
}

// 更新大类图标
export async function updateCategoryIcon(id: number, icon: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE categories SET icon=$1 WHERE id=$2', [icon, id])
}

// 新增小类
export async function addSubCategory(categoryId: number, name: string): Promise<number> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO subcategories (category_id, name, is_default, sort_order) VALUES ($1, $2, 0, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM subcategories WHERE category_id=$1))',
    [categoryId, name]
  )
  return result.lastInsertId as number
}

// 删除小类
export async function deleteSubCategory(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM subcategories WHERE id=$1', [id])
}

// 更新小类名称
export async function updateSubCategoryName(id: number, name: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE subcategories SET name=$1 WHERE id=$2', [name, id])
}

// 切换小类是否默认
export async function toggleSubCategoryDefault(id: number, isDefault: boolean): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE subcategories SET is_default=$1 WHERE id=$2', [isDefault ? 1 : 0, id])
}

// 更新小类的默认模板值
export async function updateSubCategoryDefaults(id: number, defaults: { defaultNote?: string; defaultPaymentMethod?: string; defaultAmount?: number; defaultType?: TransactionType }): Promise<void> {
  const database = await getDb()
  const sets: string[] = []
  const vals: (string | number)[] = []
  let idx = 1
  if (defaults.defaultNote !== undefined) {
    sets.push(`default_note=$${idx}`)
    vals.push(defaults.defaultNote)
    idx++
  }
  if (defaults.defaultPaymentMethod !== undefined) {
    sets.push(`default_payment_method=$${idx}`)
    vals.push(defaults.defaultPaymentMethod)
    idx++
  }
  if (defaults.defaultAmount !== undefined) {
    sets.push(`default_amount=$${idx}`)
    vals.push(defaults.defaultAmount)
    idx++
  }
  if (defaults.defaultType !== undefined) {
    sets.push(`default_type=$${idx}`)
    vals.push(defaults.defaultType)
    idx++
  }
  if (sets.length === 0) return
  vals.push(id)
  await database.execute(`UPDATE subcategories SET ${sets.join(', ')} WHERE id=$${idx}`, vals)
}

// 拖拽后批量更新大类顺序
export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const database = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute('UPDATE categories SET sort_order=$1 WHERE id=$2', [i, orderedIds[i]])
  }
}

// 拖拽后批量更新小类顺序
export async function reorderSubCategories(orderedIds: number[]): Promise<void> {
  const database = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute('UPDATE subcategories SET sort_order=$1 WHERE id=$2', [i, orderedIds[i]])
  }
}

// ========== 支付方式配置 ==========

// 获取所有支付方式
export async function getPaymentMethods(): Promise<PaymentMethodConfig[]> {
  const database = await getDb()
  return database.select<PaymentMethodConfig[]>(
    'SELECT id, name, icon FROM payment_methods ORDER BY sort_order ASC, id ASC'
  )
}

// 新增支付方式
export async function addPaymentMethod(name: string, icon: string): Promise<void> {
  const database = await getDb()
  await database.execute(
    'INSERT INTO payment_methods (name, icon, sort_order) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM payment_methods))',
    [name, icon]
  )
}

// 删除支付方式（允许强删；历史记录保留原名称文本）
export async function deletePaymentMethod(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM payment_methods WHERE id=$1', [id])
}

// 改名：同步迁移历史记录与小类默认模板里的旧名称
export async function updatePaymentMethodName(id: number, name: string): Promise<void> {
  const database = await getDb()
  const rows = await database.select<{ name: string }[]>(
    'SELECT name FROM payment_methods WHERE id=$1',
    [id]
  )
  const oldName = rows[0]?.name
  await database.execute('UPDATE payment_methods SET name=$1 WHERE id=$2', [name, id])
  if (oldName && oldName !== name) {
    await database.execute('UPDATE expenses SET payment_method=$1 WHERE payment_method=$2', [name, oldName])
    await database.execute('UPDATE subcategories SET default_payment_method=$1 WHERE default_payment_method=$2', [name, oldName])
  }
}

// 改图标
export async function updatePaymentMethodIcon(id: number, icon: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE payment_methods SET icon=$1 WHERE id=$2', [icon, id])
}

// 拖拽后批量更新顺序
export async function reorderPaymentMethods(orderedIds: number[]): Promise<void> {
  const database = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute('UPDATE payment_methods SET sort_order=$1 WHERE id=$2', [i, orderedIds[i]])
  }
}

// 某支付方式的在用笔数（删除确认弹窗提示用）
export async function countExpensesByPaymentMethod(name: string): Promise<number> {
  const database = await getDb()
  const rows = await database.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM expenses WHERE payment_method=$1',
    [name]
  )
  return rows[0]?.cnt ?? 0
}

// ========== 收支类型配置 ==========

// 获取所有收支类型（category 字段来自数据库，做白名单收窄）
export async function getTxTypes(): Promise<TxTypeConfig[]> {
  const database = await getDb()
  const rows = await database.select<{ id: number; code: string; name: string; icon: string; category: string }[]>(
    'SELECT id, code, name, icon, category FROM tx_types ORDER BY sort_order ASC, id ASC'
  )
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    icon: r.icon,
    category: (['expense', 'income', 'ignore'].includes(r.category) ? r.category : 'ignore') as TxCategory,
  }))
}

// 新增收支类型：code 先用空串插入拿 id，再回填 t_<id>
export async function addTxType(name: string, icon: string, category: TxCategory): Promise<void> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO tx_types (code, name, icon, category, sort_order) VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tx_types))',
    ['', name, icon, category]
  )
  const id = result.lastInsertId as number
  await database.execute('UPDATE tx_types SET code=$1 WHERE id=$2', [`t_${id}`, id])
}

// 删除收支类型（允许强删；老记录 code 找不到配置 → 界面显示「未定义」）
export async function deleteTxType(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM tx_types WHERE id=$1', [id])
}

// 改名（记录存 code，改名全局生效，无需迁移）
export async function updateTxTypeName(id: number, name: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE tx_types SET name=$1 WHERE id=$2', [name, id])
}

// 改图标
export async function updateTxTypeIcon(id: number, icon: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE tx_types SET icon=$1 WHERE id=$2', [icon, id])
}

// 拖拽后批量更新顺序
export async function reorderTxTypes(orderedIds: number[]): Promise<void> {
  const database = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute('UPDATE tx_types SET sort_order=$1 WHERE id=$2', [i, orderedIds[i]])
  }
}

// 某收支类型的在用笔数（删除确认弹窗提示用）
export async function countExpensesByType(code: string): Promise<number> {
  const database = await getDb()
  const rows = await database.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM expenses WHERE type=$1',
    [code]
  )
  return rows[0]?.cnt ?? 0
}
