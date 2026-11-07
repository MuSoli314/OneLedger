import Database from '@tauri-apps/plugin-sql'
import { isTauri, createWebDbConnection, type DbConnection } from './webDb'
import type { Expense, ExpenseInput, Budget, TrendPoint, CategoryWithChildren, SubCategoryChild, TransactionType, DailyTrendPoint, DailyNonDailyPoint, MonthlyStats, PaymentMethodConfig, TxTypeConfig, TxCategory, RuleCondition, SubcategoryRule } from './types'
import { categories as defaultCategories, DEFAULT_PAYMENT_METHODS, DEFAULT_TX_TYPES, NON_DAILY_DEFAULT_NAMES } from './categories'
import { parseConditions, serializeConditions, matchRulesAmount, splitLocalDate } from './subcategoryRules'
import {
  BUILTIN_FIRST_YEAR,
  collectBuiltinHolidayDays,
  fetchHolidayYear,
  holidayFetchTargets,
  shouldCheckYear,
  type HolidayDay,
} from './holidaySync'

// 分类筛选的组合键分隔符（小类名在不同大类下可能重名，故用「大类+小类」作唯一键）
// HomePage / StatsPanel / database 共用此函数，保证键格式一致
export const CAT_KEY_SEP = '§'
export const catKey = (l1: string, l2: string) => `${l1}${CAT_KEY_SEP}${l2}`

let db: DbConnection | null = null
let dbInit: Promise<DbConnection> | null = null

// ===== 日期 / 月份属性内存缓存 =====
// 属性表：一天/一月一行，is_locked 只是当前唯一的属性字段（将来加字段不用再建表）。
// 生效规则：某天锁定 = 月已锁 或 该天已锁（月锁优先级高，但两个属性互不修改）。
let lockedMonths = new Set<string>()
let lockedDays = new Set<string>()

/** 同步查询某天是否处于锁定状态（月锁 或 日锁，任一成立即锁定） */
export function isDateLocked(date: string): boolean {
  if (!date) return false
  return lockedMonths.has(date.slice(0, 7)) || lockedDays.has(date)
}

/** 同步查询某个月是否被整月锁定 */
export function isMonthLocked(month: string): boolean {
  return lockedMonths.has(month)
}

/** 写操作前的统一拦截：锁定状态下不允许新增/修改/删除 */
function assertDateEditable(date: string) {
  if (isDateLocked(date)) {
    throw new Error(`${date} 已锁定，请先解锁后再修改`)
  }
}

// ===== 小类条件规则内存缓存 =====
// 规则匹配会被频繁调用（列表渲染 / 自动记账），必须同步返回，所以连库时整表读进内存。
// key = 小类 id，value = 已按 sort_order 升序排好的规则（顺序即优先级）。
let subRules = new Map<number, SubcategoryRule[]>()

/** 同步读取某个小类的全部规则（按匹配顺序）；没有规则返回 [] */
export function getSubcategoryRules(subId: number): SubcategoryRule[] {
  return subRules.get(subId) ?? []
}

/** 同步读取某个小类的规则条数（界面上的数字角标用） */
export function getSubcategoryRuleCount(subId: number): number {
  return (subRules.get(subId) ?? []).length
}

/**
 * 同步把「某个小类 × 某一天」匹配成金额。这是**唯一的**金额来源（设计文档 6.1）。
 * @returns 命中的金额；一条都没命中返回 null（= 这个小类这天不生效）
 */
export function matchSubcategoryAmount(
  subId: number,
  date: string,
  isWorkdayFn: (date: string) => boolean = isWorkday
): number | null {
  return matchRulesAmount(subRules.get(subId) ?? [], date, isWorkdayFn)
}

/** 同步读取全部小类规则（界面按小类分组用） */
export function getAllSubcategoryRules(): SubcategoryRule[] {
  const all: SubcategoryRule[] = []
  for (const list of subRules.values()) all.push(...list)
  return all
}

function rulesFromRows(
  rows: { id: number; subcategory_id: number; sort_order: number; enabled: number; conditions: string; amount: number }[]
): Map<number, SubcategoryRule[]> {
  const map = new Map<number, SubcategoryRule[]>()
  for (const r of rows) {
    const list = map.get(r.subcategory_id) ?? []
    list.push({
      id: r.id,
      subcategory_id: r.subcategory_id,
      sort_order: r.sort_order,
      enabled: r.enabled === 1,
      conditions: parseConditions(r.conditions),
      amount: r.amount || 0,
    })
    map.set(r.subcategory_id, list)
  }
  return map
}

/** 重新把 subcategory_rules 整表读进内存缓存（写操作后调用；表很小，代价可忽略） */
async function reloadSubRules(): Promise<void> {
  const database = await getDb()
  const rows = await database.select<
    { id: number; subcategory_id: number; sort_order: number; enabled: number; conditions: string; amount: number }[]
  >('SELECT id, subcategory_id, sort_order, enabled, conditions, amount FROM subcategory_rules ORDER BY subcategory_id ASC, sort_order ASC, id ASC')
  subRules = rulesFromRows(rows)
}

// ===== 节假日数据内存缓存 =====
// 工作日判定要被规则匹配频繁调用，必须**同步**返回，所以整表读进内存（同 lockedDays 的思路）。
// 表里只有「特殊日期」（放假 + 调休补班）；查不到 = 按周一~周五判断。
let holidayDays = new Map<string, { name: string; isOffDay: boolean }>()
let holidayYears = new Map<number, { ready: boolean; source: string; fetchedAt: string | null; lastCheckedAt: string | null }>()

/** 同步判断某天是不是「上班日」（含法定节假日与调休：补班日算上班） */
export function isWorkday(date: string): boolean {
  const special = holidayDays.get(date)
  if (special) return !special.isOffDay
  const { isoWeekday } = splitLocalDate(date)
  return isoWeekday <= 5
}

/** 同步判断某天是不是「休息日」（周末 + 法定节假日，不含调休补班） */
export function isRestDay(date: string): boolean {
  return !isWorkday(date)
}

/** 同步取某天的节假日名称（不是特殊日期返回空字符串） */
export function getHolidayName(date: string): string {
  return holidayDays.get(date)?.name ?? ''
}

export interface HolidayDataStatus {
  currentYear: number
  nextYear: number
  /** 已就绪（数据完整可用）的年份，升序 */
  readyYears: number[]
  /** 最后一个就绪年份（用来提示「已更新至 X 年」） */
  latestReadyYear: number | null
  currentYearReady: boolean
  nextYearReady: boolean
  /** 表里的特殊日期条数（0 = 还没导入任何数据） */
  specialDayCount: number
}

/** 同步读取节假日数据状态（界面状态行用；缓存未加载时返回空状态） */
export function getHolidayDataStatus(now: Date = new Date()): HolidayDataStatus {
  const currentYear = now.getFullYear()
  const readyYears = [...holidayYears.entries()]
    .filter(([, v]) => v.ready)
    .map(([y]) => y)
    .sort((a, b) => a - b)
  return {
    currentYear,
    nextYear: currentYear + 1,
    readyYears,
    latestReadyYear: readyYears.length > 0 ? readyYears[readyYears.length - 1] : null,
    currentYearReady: holidayYears.get(currentYear)?.ready === true,
    nextYearReady: holidayYears.get(currentYear + 1)?.ready === true,
    specialDayCount: holidayDays.size,
  }
}

/** 等数据库连上（缓存加载完）再读状态，界面首次渲染用 */
export async function getHolidayDataStatusAsync(): Promise<HolidayDataStatus> {
  await getDb()
  return getHolidayDataStatus()
}

/** 把 holidays / holiday_years 读进内存 */
async function loadHolidayCache(conn: DbConnection): Promise<void> {
  const dayRows = await conn.select<{ date: string; name: string; is_off_day: number }[]>(
    'SELECT date, name, is_off_day FROM holidays'
  )
  const yearRows = await conn.select<
    { year: number; ready: number; source: string; fetched_at: string | null; last_checked_at: string | null }[]
  >('SELECT year, ready, source, fetched_at, last_checked_at FROM holiday_years')
  holidayDays = new Map(dayRows.map((r) => [r.date, { name: r.name || '', isOffDay: r.is_off_day === 1 }]))
  holidayYears = new Map(
    yearRows.map((r) => [
      r.year,
      { ready: r.ready === 1, source: r.source || '', fetchedAt: r.fetched_at, lastCheckedAt: r.last_checked_at },
    ])
  )
}

/** 分批多行插入（一条 SQL 插 N 行，避免几百次往返） */
async function insertHolidayDays(conn: DbConnection, days: HolidayDay[]): Promise<void> {
  const CHUNK = 50
  for (let i = 0; i < days.length; i += CHUNK) {
    const chunk = days.slice(i, i + CHUNK)
    const values: string[] = []
    const params: (string | number)[] = []
    chunk.forEach((d, j) => {
      const base = j * 4
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`)
      params.push(d.date, d.year, d.name, d.isOffDay ? 1 : 0)
    })
    await conn.execute(
      `INSERT OR REPLACE INTO holidays (date, year, name, is_off_day) VALUES ${values.join(', ')}`,
      params
    )
  }
}

/** 写入（或覆盖）某一年的数据，并标记该年就绪 */
async function replaceHolidayYear(conn: DbConnection, year: number, days: HolidayDay[], source: string): Promise<void> {
  const now = new Date().toISOString()
  await conn.execute('DELETE FROM holidays WHERE year=$1', [year])
  await insertHolidayDays(conn, days)
  const existing = await conn.select<{ year: number }[]>('SELECT year FROM holiday_years WHERE year=$1 LIMIT 1', [year])
  if (existing.length > 0) {
    await conn.execute(
      'UPDATE holiday_years SET ready=1, source=$1, fetched_at=$2, last_checked_at=$2 WHERE year=$3',
      [source, now, year]
    )
  } else {
    await conn.execute(
      'INSERT INTO holiday_years (year, ready, source, fetched_at, last_checked_at) VALUES ($1, 1, $2, $3, $3)',
      [year, source, now]
    )
  }
}

/** 只记录「今天联网查过了」，不标记就绪（没公布 / 联网失败都走这里，用于 24 小时节流） */
async function markHolidayChecked(conn: DbConnection, year: number): Promise<void> {
  const now = new Date().toISOString()
  const existing = await conn.select<{ year: number }[]>('SELECT year FROM holiday_years WHERE year=$1 LIMIT 1', [year])
  if (existing.length > 0) {
    await conn.execute('UPDATE holiday_years SET last_checked_at=$1 WHERE year=$2', [now, year])
  } else {
    await conn.execute(
      'INSERT INTO holiday_years (year, ready, source, last_checked_at) VALUES ($1, 0, "", $2)',
      [year, now]
    )
  }
}

/**
 * 首次安装：把依赖库内置的节假日数据一次性导入（2001–当年），保证**离线也能判定**。
 * 之后联网抓到的数据以 holiday-cn 为准覆盖。只在 holiday_years 为空时执行。
 */
async function seedBuiltinHolidays(conn: DbConnection): Promise<void> {
  const count = await conn.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM holiday_years')
  if ((count[0]?.cnt ?? 0) > 0) return
  const currentYear = new Date().getFullYear()
  for (let year = BUILTIN_FIRST_YEAR; year <= currentYear; year++) {
    const days = collectBuiltinHolidayDays(year, year)
    if (days.length === 0) continue // 该年内置也没有（尚未公布）→ 不建年份行，留给联网抓取
    await replaceHolidayYear(conn, year, days, 'builtin')
  }
}

let holidaySyncRun: Promise<{ checked: number; updated: number }> | null = null

/**
 * 启动检查 / 「立即更新」：按节流规则把缺的年份补上。
 * 永不抛异常（联网失败静默），返回本次真正联网检查的年份数与成功写入的年份数。
 */
export async function ensureHolidayData(opts: { force?: boolean } = {}): Promise<{ checked: number; updated: number }> {
  const force = opts.force === true
  // 启动时 React StrictMode 会把 effect 跑两遍 → 合并成一次（force 不受影响）
  if (holidaySyncRun) {
    if (!force) return holidaySyncRun
    await holidaySyncRun.catch(() => {})
  }
  holidaySyncRun = runHolidaySync(force).finally(() => {
    holidaySyncRun = null
  })
  return holidaySyncRun
}

async function runHolidaySync(force: boolean): Promise<{ checked: number; updated: number }> {
  try {
    const database = await getDb()
    const now = new Date()
    const status = getHolidayDataStatus(now)
    const targets = holidayFetchTargets({
      currentYear: status.currentYear,
      currentMonth: now.getMonth() + 1,
      isReady: (year) => holidayYears.get(year)?.ready === true,
      lastReadyYear: status.latestReadyYear,
    })
    let checked = 0
    let updated = 0
    for (const year of targets) {
      const record = holidayYears.get(year)
      if (!shouldCheckYear(record?.lastCheckedAt ?? null, now.getTime(), force)) continue
      checked++
      const result = await fetchHolidayYear(year)
      if (!result.ok || !result.published) {
        // 联网失败 / 该年安排尚未公布 → 只记「查过了」，不标记就绪，下次继续试
        await markHolidayChecked(database, year)
        continue
      }
      await replaceHolidayYear(database, year, result.days, 'holiday-cn')
      updated++
    }
    if (checked > 0) await loadHolidayCache(database)
    return { checked, updated }
  } catch (err) {
    console.error('节假日数据更新失败:', err)
    return { checked: 0, updated: 0 }
  }
}

async function getDb(): Promise<DbConnection> {
  if (db) return db
  if (!dbInit) {
    dbInit = connectDb()
  }
  return dbInit
}
/** 尝试连接数据库，失败时自动重试 */
async function connectDb(retries = 2): Promise<DbConnection> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 桌面版（Tauri）用原生 SQL 插件；网页版用浏览器内运行的 sql.js，接口形状一致
      const conn: DbConnection = isTauri()
        ? await Database.load('sqlite:one_ledger.db')
        : await createWebDbConnection()

      // 确保消费记录表存在（含 payment_method、type 和 is_non_daily 字段）
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, category_l1 TEXT NOT NULL, category_l2 TEXT NOT NULL, date TEXT NOT NULL, note TEXT DEFAULT "", payment_method TEXT DEFAULT "", type TEXT DEFAULT "expense", is_non_daily INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
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

      // 兼容旧数据库：尝试添加 is_non_daily 列（已存在则忽略）
      try {
        await conn.execute('ALTER TABLE expenses ADD COLUMN is_non_daily INTEGER NOT NULL DEFAULT 0')
      } catch {
        // 列已存在，忽略
      }

      // 分类表
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL DEFAULT "📂", sort_order INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 1)'
      )
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS subcategories (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE)'
      )
      // 小类条件规则表（v2）：一个可选多条，「启用勾选 + 条件 + 金额」。
      // 金额的唯一来源；支付方式 / 收支类型 / 备注 / 日常标记仍取小类主行（公共属性）。
      // conditions 空数组 = 「总是」（匹配所有日期）—— 没有独立的「兜底」功能，它就是一条普通规则。
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS subcategory_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, subcategory_id INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, conditions TEXT NOT NULL DEFAULT "[]", amount REAL NOT NULL DEFAULT 0, FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE)'
      )

      // 迁移：给大类添加默认标记（老库默认全勾选，保持「添加某天」行为不变）
      try {
        await conn.execute('ALTER TABLE categories ADD COLUMN is_default INTEGER NOT NULL DEFAULT 1')
      } catch { /* 列已存在，忽略 */ }

      // 迁移：给子分类添加默认备注/支付方式/金额/类型字段
      for (const col of ['default_note TEXT DEFAULT ""', 'default_payment_method TEXT DEFAULT ""', 'default_amount REAL DEFAULT 0', 'default_type TEXT DEFAULT "expense"']) {
        try {
          await conn.execute(`ALTER TABLE subcategories ADD COLUMN ${col}`)
        } catch { /* 列已存在，忽略 */ }
      }

      // 迁移：给子分类添加默认非日常标记（已存在则忽略）
      let addedSubNonDaily = false
      try {
        await conn.execute('ALTER TABLE subcategories ADD COLUMN default_is_non_daily INTEGER NOT NULL DEFAULT 0')
        addedSubNonDaily = true
      } catch { /* 列已存在，忽略 */ }

      // 首次迁移（列刚加上）：按名称回填预设的非日常小类默认值，保证老库「新记的自动带对」。
      // 只回填一次、只置 1 不覆盖 0 —— 用户手动取消非日常后重启不会被改回。
      if (addedSubNonDaily) {
        const names = Array.from(NON_DAILY_DEFAULT_NAMES)
        const placeholders = names.map((_, i) => `$${i + 1}`).join(', ')
        await conn.execute(
          `UPDATE subcategories SET default_is_non_daily=1 WHERE name IN (${placeholders})`,
          names
        )
      }

      // 检查是否需要播种默认分类
      const catCount = await conn.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM categories')
      if (catCount[0]?.cnt === 0) {
        for (let i = 0; i < defaultCategories.length; i++) {
          const cat = defaultCategories[i]
          const result = await conn.execute(
            'INSERT INTO categories (name, icon, sort_order, is_default) VALUES ($1, $2, $3, 1)',
            [cat.name, cat.icon, i]
          )
          const catId = result.lastInsertId as number
          for (let j = 0; j < cat.children.length; j++) {
            // 新装默认支付方式 = 第一个默认支付方式（与界面新增小类兜底行为一致）
            const defaultPay = DEFAULT_PAYMENT_METHODS[0]?.name ?? ''
            const is_non_dailyDefault = NON_DAILY_DEFAULT_NAMES.has(cat.children[j].name) ? 1 : 0
            // 小类默认标记来自 categories.ts 的 is_default（如餐饮饮食的早餐/午餐/晚餐）
            const isDefaultSeed = cat.children[j].is_default ? 1 : 0
            await conn.execute(
              'INSERT INTO subcategories (category_id, name, is_default, default_payment_method, default_is_non_daily, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [catId, cat.children[j].name, isDefaultSeed, defaultPay, is_non_dailyDefault, j]
            )
          }
        }
      }

      // 迁移 v1（2026-08-16）：默认小类预设 —— 「餐饮饮食」的早餐/午餐/晚餐标记为默认。
      // 新装播种已生效；老库用 SQLite user_version 做一次性回填（置 1 后不再执行，
      // 用户之后在分类管理页手动取消的默认不会被改回）。
      const uvRows = await conn.select<{ user_version: number }[]>('PRAGMA user_version')
      const userVersion = uvRows[0]?.user_version ?? 0
      if (userVersion < 1) {
        await conn.execute(
          "UPDATE subcategories SET is_default=1 WHERE category_id IN (SELECT id FROM categories WHERE name='餐饮饮食') AND name IN ('🥚早餐','🍚午餐','🍜晚餐')"
        )
        await conn.execute('PRAGMA user_version = 1')
      }

      // 迁移 v2（2026-10-24）：小类固定默认值 → 条件规则。
      // 给每个「已勾 ✓ 的默认小类」生成一条「总是」规则（金额 = 原来的 default_amount），
      // 于是升级后的自动记账结果和升级前**完全一致**；用户想改成条件规则再自己编辑。
      // 一次性：置 2 后不再执行，用户之后删掉的规则不会被重新加回。
      if (userVersion < 2) {
        await conn.execute(
          "INSERT INTO subcategory_rules (subcategory_id, sort_order, enabled, conditions, amount) SELECT id, 0, 1, '[]', COALESCE(default_amount, 0) FROM subcategories s WHERE (is_default=1 OR COALESCE(default_amount, 0) <> 0) AND NOT EXISTS (SELECT 1 FROM subcategory_rules r WHERE r.subcategory_id = s.id)"
        )
        await conn.execute('PRAGMA user_version = 2')
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

      // 日期属性表 / 月份属性表：一天（一月）一行，当前只有 is_locked 一个属性字段。
      // 属性表结构便于将来扩展（例如备注、颜色、归档标记等），不必再新建表。
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS day_attributes (date TEXT PRIMARY KEY, is_locked INTEGER NOT NULL DEFAULT 0)'
      )
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS month_attributes (month TEXT PRIMARY KEY, is_locked INTEGER NOT NULL DEFAULT 0)'
      )
      // 锁状态读进内存缓存（写操作靠它做同步拦截）
      const lockMonthRows = await conn.select<{ month: string }[]>(
        'SELECT month FROM month_attributes WHERE is_locked=1'
      )
      const lockDayRows = await conn.select<{ date: string }[]>(
        'SELECT date FROM day_attributes WHERE is_locked=1'
      )
      lockedMonths = new Set(lockMonthRows.map((r) => r.month))
      lockedDays = new Set(lockDayRows.map((r) => r.date))

      // 小类条件规则读进内存缓存（同步匹配用）
      const ruleRows = await conn.select<
        { id: number; subcategory_id: number; sort_order: number; enabled: number; conditions: string; amount: number }[]
      >('SELECT id, subcategory_id, sort_order, enabled, conditions, amount FROM subcategory_rules ORDER BY subcategory_id ASC, sort_order ASC, id ASC')
      subRules = rulesFromRows(ruleRows)

      // 节假日数据表：只存「特殊日期」（放假 + 调休补班）；没有的日期在判定时按周一~周五推。
      // holiday_years 每年一行，记录该年数据是否就绪、来源、最后一次联网检查时间（用于 24 小时节流）。
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS holidays (date TEXT PRIMARY KEY, year INTEGER NOT NULL, name TEXT NOT NULL DEFAULT "", is_off_day INTEGER NOT NULL DEFAULT 0)'
      )
      await conn.execute(
        'CREATE TABLE IF NOT EXISTS holiday_years (year INTEGER PRIMARY KEY, ready INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT "", fetched_at TEXT, last_checked_at TEXT)'
      )
      await loadHolidayCache(conn)
      // 首次安装：导入依赖库内置的节假日数据（2001–当年），离线也能判定工作日
      await seedBuiltinHolidays(conn)

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

// 添加一条消费记录（锁定日期不允许新增）
export async function addExpense(input: ExpenseInput): Promise<number> {
  const database = await getDb()
  assertDateEditable(input.date)
  const result = await database.execute(
    'INSERT INTO expenses (amount, category_l1, category_l2, date, note, payment_method, type, is_non_daily) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [input.amount, input.category_l1, input.category_l2, input.date, input.note, input.payment_method || '', input.type || 'expense', input.is_non_daily ? 1 : 0]
  )
  return result.lastInsertId as number
}

// 更新一条消费记录（原日期或新日期任一被锁都不允许）
export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const database = await getDb()
  const rows = await database.select<{ date: string }[]>('SELECT date FROM expenses WHERE id=$1', [id])
  const oldDate = rows[0]?.date
  if (oldDate) assertDateEditable(oldDate)
  assertDateEditable(input.date)
  await database.execute(
    'UPDATE expenses SET amount=$1, category_l1=$2, category_l2=$3, date=$4, note=$5, payment_method=$6, type=$7, is_non_daily=$8 WHERE id=$9',
    [input.amount, input.category_l1, input.category_l2, input.date, input.note, input.payment_method || '', input.type || 'expense', input.is_non_daily ? 1 : 0, id]
  )
}

// 删除一条消费记录（锁定日期不允许删除）
export async function deleteExpense(id: number): Promise<void> {
  const database = await getDb()
  const rows = await database.select<{ date: string }[]>('SELECT date FROM expenses WHERE id=$1', [id])
  const date = rows[0]?.date
  if (date) assertDateEditable(date)
  await database.execute('DELETE FROM expenses WHERE id=$1', [id])
}

// 删除某一天的所有消费记录（锁定日期不允许删除）
export async function deleteExpensesByDate(date: string): Promise<void> {
  const database = await getDb()
  assertDateEditable(date)
  await database.execute('DELETE FROM expenses WHERE date=$1', [date])
}

// 删除某一天某个大类的所有消费记录（锁定日期不允许删除）
export async function deleteExpensesByCategory(date: string, category_l1: string): Promise<void> {
  const database = await getDb()
  assertDateEditable(date)
  await database.execute('DELETE FROM expenses WHERE date=$1 AND category_l1=$2', [date, category_l1])
}

// 统计某天还剩多少条记录（删除后判断这天是否已被删空 → 自动标记「当天无消费」）
export async function countExpensesByDate(date: string): Promise<number> {
  const database = await getDb()
  const rows = await database.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM expenses WHERE date=$1',
    [date]
  )
  return rows[0]?.cnt ?? 0
}

// 查询消费记录列表
// 注意：不传 limit 时不设上限（记录再多也不会被悄悄截断）
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

  let sql: string
  if (params?.limit !== undefined) {
    // 显式传 limit 才分页
    sql = `SELECT * FROM expenses ${where} ORDER BY date DESC, id ASC LIMIT $${idx} OFFSET $${idx + 1}`
    values.push(params.limit, params.offset ?? 0)
  } else {
    sql = `SELECT * FROM expenses ${where} ORDER BY date DESC, id ASC`
  }
  const rows = await database.select<(Omit<Expense, 'is_non_daily'> & { is_non_daily: number })[]>(sql, values)
  return rows.map((r) => ({ ...r, is_non_daily: r.is_non_daily === 1 }))
}

// 获取所有记录（用于导出）
export async function getAllExpenses(): Promise<Expense[]> {
  const database = await getDb()
  const rows = await database.select<(Omit<Expense, 'is_non_daily'> & { is_non_daily: number })[]>(
    'SELECT * FROM expenses ORDER BY date DESC, id ASC'
  )
  return rows.map((r) => ({ ...r, is_non_daily: r.is_non_daily === 1 }))
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

// 按日期范围聚合「日常 / 非日常」两类支出（右栏当月支出图双线数据源）。
// 与 getDailyTotals 同口径：只统计收支类型为 expense 的记录；categoryL1 传值则只看该大类。
export async function getDailyTotalsByNonDaily(startDate: string, endDate: string, categoryL1?: string): Promise<DailyNonDailyPoint[]> {
  const database = await getDb()
  const conditions = ['date >= $1', 'date <= $2', "type IN (SELECT code FROM tx_types WHERE category='expense')"]
  const values: string[] = [startDate, endDate]
  if (categoryL1) {
    conditions.push('category_l1=$3')
    values.push(categoryL1)
  }
  const sql = `SELECT date,
    COALESCE(SUM(CASE WHEN is_non_daily=0 THEN amount END), 0) as dailyTotal,
    COALESCE(SUM(CASE WHEN is_non_daily=1 THEN amount END), 0) as nonDailyTotal
    FROM expenses WHERE ${conditions.join(' AND ')} GROUP BY date ORDER BY date ASC`
  return database.select<DailyNonDailyPoint[]>(sql, values)
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

// ========== 日期 / 月份属性（当前只有「锁」一个字段） ==========

/** 读取全部锁状态（月锁 + 日锁），供界面渲染 */
export async function listLocks(): Promise<{ months: string[]; days: string[] }> {
  await getDb() // 确保连接已建立、缓存已加载
  return { months: [...lockedMonths], days: [...lockedDays] }
}

/**
 * 设置 / 取消月锁。
 * ⚠️ 只写月属性，不会去改任何一天的日属性 —— 两个属性互不修改。
 * 解锁只把 is_locked 置 0（保留该行，将来它可能挂着别的属性）。
 */
export async function setMonthLocked(month: string, locked: boolean): Promise<void> {
  const database = await getDb()
  const existing = await database.select<{ month: string }[]>(
    'SELECT month FROM month_attributes WHERE month=$1 LIMIT 1',
    [month]
  )
  if (existing.length > 0) {
    await database.execute('UPDATE month_attributes SET is_locked=$1 WHERE month=$2', [locked ? 1 : 0, month])
  } else {
    await database.execute('INSERT INTO month_attributes (month, is_locked) VALUES ($1, $2)', [month, locked ? 1 : 0])
  }
  if (locked) lockedMonths.add(month)
  else lockedMonths.delete(month)
}

/** 设置 / 取消某天的日锁（月属性不受影响；解锁同样只置 0 保留行） */
export async function setDayLocked(date: string, locked: boolean): Promise<void> {
  const database = await getDb()
  const existing = await database.select<{ date: string }[]>(
    'SELECT date FROM day_attributes WHERE date=$1 LIMIT 1',
    [date]
  )
  if (existing.length > 0) {
    await database.execute('UPDATE day_attributes SET is_locked=$1 WHERE date=$2', [locked ? 1 : 0, date])
  } else {
    await database.execute('INSERT INTO day_attributes (date, is_locked) VALUES ($1, $2)', [date, locked ? 1 : 0])
  }
  if (locked) lockedDays.add(date)
  else lockedDays.delete(date)
}

// ========== 数据导出 ==========

// CSV 字段转义：含逗号/引号/换行的字段用双引号包裹，内部引号双写
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function expensesToCSV(expenses: Expense[], txTypes: TxTypeConfig[]): string {
  const headers = ['日期', '一级分类', '二级分类', '金额(元)', '支付方式', '备注', '收支类型', '是否非日常']
  const typeMap = new Map(txTypes.map((t) => [t.code, t.name]))
  const rows = expenses.map((e) =>
    [e.date, e.category_l1, e.category_l2, e.amount.toFixed(2), e.payment_method, e.note, typeMap.get(e.type) || '未定义', e.is_non_daily ? '非日常' : '日常']
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
    { id: number; name: string; icon: string; sort_order: number; is_default: number }[]
  >('SELECT * FROM categories ORDER BY sort_order ASC, id ASC')

  const subRows = await database.select<
    { id: number; category_id: number; name: string; is_default: number; default_note: string; default_payment_method: string; default_amount: number; default_type: string; default_is_non_daily: number; sort_order: number }[]
  >('SELECT id, category_id, name, is_default, default_note, default_payment_method, default_amount, default_type, default_is_non_daily, sort_order FROM subcategories ORDER BY sort_order ASC, id ASC')

  const subMap: Record<number, { id: number; name: string; is_default: boolean; default_note: string; default_payment_method: string; default_amount: number; default_type: TransactionType; default_is_non_daily: boolean }[]> = {}
  for (const s of subRows) {
    if (!subMap[s.category_id]) subMap[s.category_id] = []
    subMap[s.category_id].push({ id: s.id, name: s.name, is_default: s.is_default === 1, default_note: s.default_note || '', default_payment_method: s.default_payment_method || '', default_amount: s.default_amount || 0, default_type: (s.default_type as TransactionType) || 'expense', default_is_non_daily: s.default_is_non_daily === 1 })
  }

  return catRows.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    is_default: c.is_default === 1,
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

// 删除大类（级联删除所有子分类及其条件规则）
export async function deleteCategory(id: number): Promise<void> {
  const database = await getDb()
  await database.execute(
    'DELETE FROM subcategory_rules WHERE subcategory_id IN (SELECT id FROM subcategories WHERE category_id=$1)',
    [id]
  )
  await database.execute('DELETE FROM subcategories WHERE category_id=$1', [id])
  await database.execute('DELETE FROM categories WHERE id=$1', [id])
  await reloadSubRules()
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

// 切换大类是否默认（是否参与「添加某天」自动记账）
export async function toggleCategoryDefault(id: number, is_default: boolean): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE categories SET is_default=$1 WHERE id=$2', [is_default ? 1 : 0, id])
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

// 删除小类（连同它名下的条件规则一起删；SQLite 默认不开启外键，故手动清理）
export async function deleteSubCategory(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM subcategory_rules WHERE subcategory_id=$1', [id])
  await database.execute('DELETE FROM subcategories WHERE id=$1', [id])
  await reloadSubRules()
}

// 更新小类名称
export async function updateSubCategoryName(id: number, name: string): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE subcategories SET name=$1 WHERE id=$2', [name, id])
}

// 切换小类是否默认（= 是否参与自动记账的总开关）
// 勾上的瞬间如果一条规则都没有，自动补一条「总是 ¥0」——否则「勾了 ✓ 却什么都不记」很困惑。
export async function toggleSubCategoryDefault(id: number, is_default: boolean): Promise<void> {
  const database = await getDb()
  await database.execute('UPDATE subcategories SET is_default=$1 WHERE id=$2', [is_default ? 1 : 0, id])
  if (is_default && (subRules.get(id)?.length ?? 0) === 0) {
    await database.execute(
      'INSERT INTO subcategory_rules (subcategory_id, sort_order, enabled, conditions, amount) VALUES ($1, 0, 1, \'[]\', 0)',
      [id]
    )
    await reloadSubRules()
  }
}

// 更新小类的默认模板值
export async function updateSubCategoryDefaults(id: number, defaults: { default_note?: string; default_payment_method?: string; default_amount?: number; default_type?: TransactionType; default_is_non_daily?: boolean }): Promise<void> {
  const database = await getDb()
  const sets: string[] = []
  const vals: (string | number)[] = []
  let idx = 1
  if (defaults.default_note !== undefined) {
    sets.push(`default_note=$${idx}`)
    vals.push(defaults.default_note)
    idx++
  }
  if (defaults.default_payment_method !== undefined) {
    sets.push(`default_payment_method=$${idx}`)
    vals.push(defaults.default_payment_method)
    idx++
  }
  if (defaults.default_amount !== undefined) {
    sets.push(`default_amount=$${idx}`)
    vals.push(defaults.default_amount)
    idx++
  }
  if (defaults.default_type !== undefined) {
    sets.push(`default_type=$${idx}`)
    vals.push(defaults.default_type)
    idx++
  }
  if (defaults.default_is_non_daily !== undefined) {
    sets.push(`default_is_non_daily=$${idx}`)
    vals.push(defaults.default_is_non_daily ? 1 : 0)
    idx++
  }
  if (sets.length === 0) return
  vals.push(id)
  await database.execute(`UPDATE subcategories SET ${sets.join(', ')} WHERE id=$${idx}`, vals)
}

// 拼一条批量重排 SQL：UPDATE t SET sort_order = CASE id WHEN $1 THEN $2 ... END WHERE id IN ($1, $3, ...)
// 用一条语句代替 N 次串行 UPDATE，落位等待从「N 次往返」降到「1 次」
function buildReorderSql(table: string, count: number): string {
  const cases = Array.from({ length: count }, (_, i) => `WHEN $${i * 2 + 1} THEN $${i * 2 + 2}`).join(' ')
  const inList = Array.from({ length: count }, (_, i) => `$${i * 2 + 1}`).join(', ')
  return `UPDATE ${table} SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (${inList})`
}

function reorderParams(orderedIds: number[]): unknown[] {
  const params: unknown[] = []
  orderedIds.forEach((id, i) => params.push(id, i))
  return params
}

// 拖拽后批量更新大类顺序
export async function reorderCategories(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return
  const database = await getDb()
  await database.execute(buildReorderSql('categories', orderedIds.length), reorderParams(orderedIds))
}

// 拖拽后批量更新小类顺序
export async function reorderSubCategories(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return
  const database = await getDb()
  await database.execute(buildReorderSql('subcategories', orderedIds.length), reorderParams(orderedIds))
}

// ========== 小类条件规则（subcategory_rules） ==========
// 规则 = 启用勾选 + 条件 + 金额；顺序即优先级（从上往下，命中第一条即用）。
// 所有写操作完成后都重新读一遍缓存，保证内存与库一致。

/** 新增一条规则，返回新规则 id。新规则默认「总是」+ 金额 0（由调用方传参决定） */
export async function addSubcategoryRule(
  subId: number,
  conditions: RuleCondition[] = [],
  amount: number = 0
): Promise<number> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO subcategory_rules (subcategory_id, sort_order, enabled, conditions, amount) VALUES ($1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM subcategory_rules WHERE subcategory_id=$1), 1, $2, $3)',
    [subId, serializeConditions(conditions), amount]
  )
  await reloadSubRules()
  return result.lastInsertId as number
}

/** 修改规则（启用勾选 / 条件 / 金额，传哪个改哪个） */
export async function updateSubcategoryRule(
  id: number,
  patch: { enabled?: boolean; conditions?: RuleCondition[]; amount?: number }
): Promise<void> {
  const database = await getDb()
  const sets: string[] = []
  const vals: (string | number)[] = []
  let idx = 1
  if (patch.enabled !== undefined) {
    sets.push(`enabled=$${idx++}`)
    vals.push(patch.enabled ? 1 : 0)
  }
  if (patch.conditions !== undefined) {
    sets.push(`conditions=$${idx++}`)
    vals.push(serializeConditions(patch.conditions))
  }
  if (patch.amount !== undefined) {
    sets.push(`amount=$${idx++}`)
    vals.push(patch.amount)
  }
  if (sets.length === 0) return
  vals.push(id)
  await database.execute(`UPDATE subcategory_rules SET ${sets.join(', ')} WHERE id=$${idx}`, vals)
  await reloadSubRules()
}

/** 删除一条规则（删掉后就不再参与匹配） */
export async function deleteSubcategoryRule(id: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM subcategory_rules WHERE id=$1', [id])
  await reloadSubRules()
}

/** 清空某个小类的全部规则（「系统默认」一键恢复时用） */
export async function deleteSubcategoryRules(subId: number): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM subcategory_rules WHERE subcategory_id=$1', [subId])
  await reloadSubRules()
}

export interface ResolvedSubDefaults {
  /** 是否有规则命中（批量入口只给 matched=true 的小类写记录） */
  matched: boolean
  amount: number
  note: string
  payment_method: string
  type: TransactionType
  is_non_daily: boolean
}

/**
 * 解析「某小类在某天该带出什么值」—— 4 个「取默认值」的入口共用（设计文档 6.1）。
 *
 * · 金额**只**来自规则（从上往下，命中第一条）；
 * · 支付方式 / 收支类型 / 备注 / 日常标记**永远取主行**（小类的公共属性）；
 * · matched=false（一条规则都没命中）时金额为 0：批量入口据此跳过这条记录，手动入口则给一行让用户自己填。
 *
 * 注：规则是否生效不看小类的 ✓（✓ 管的是「批量自动记账要不要带上它」）；
 * 手动点某个小类时，只要它配了规则就按规则预填金额，这和以前「预填默认金额」的手感一致。
 */
export function resolveSubDefaults(
  sub: Pick<SubCategoryChild, 'id' | 'default_note' | 'default_payment_method' | 'default_type' | 'default_is_non_daily'>,
  date: string
): ResolvedSubDefaults {
  const amount = matchSubcategoryAmount(sub.id, date)
  return {
    matched: amount !== null,
    amount: amount ?? 0,
    note: sub.default_note || '',
    payment_method: sub.default_payment_method || '',
    type: sub.default_type || 'expense',
    is_non_daily: sub.default_is_non_daily || false,
  }
}

/** 拖拽后批量更新规则顺序（同一小类内） */
export async function reorderSubcategoryRules(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) return
  const database = await getDb()
  await database.execute(buildReorderSql('subcategory_rules', orderedIds.length), reorderParams(orderedIds))
  await reloadSubRules()
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
  if (orderedIds.length === 0) return
  const database = await getDb()
  await database.execute(buildReorderSql('payment_methods', orderedIds.length), reorderParams(orderedIds))
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
  if (orderedIds.length === 0) return
  const database = await getDb()
  await database.execute(buildReorderSql('tx_types', orderedIds.length), reorderParams(orderedIds))
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
