import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

/** 与 Tauri SQL 插件相同形状的连接接口，桌面版 / 网页版共用（database.ts 无需感知差异） */
export interface DbConnection {
  execute(
    query: string,
    bindValues?: unknown[]
  ): Promise<{ rowsAffected: number; lastInsertId?: number }>
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T>
}

/** 是否运行在 Tauri 桌面环境（浏览器里没有 Tauri 注入的全局对象） */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ---------- IndexedDB 持久化：网页版数据保存在浏览器本地 ----------

const IDB_NAME = 'one_ledger'
const IDB_STORE = 'kv'
const DB_KEY = 'sqlite_db'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------- sql.js：在浏览器里运行同一个 SQLite ----------

let sqlitePromise: Promise<SqlJsDatabase> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let activeDb: SqlJsDatabase | null = null

async function getSqlite(): Promise<SqlJsDatabase> {
  if (!sqlitePromise) {
    sqlitePromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      const saved = await idbGet(DB_KEY)
      const db = saved && saved.length ? new SQL.Database(saved) : new SQL.Database()
      activeDb = db
      installAutoSave(db)
      return db
    })()
  }
  return sqlitePromise
}

/** 把 sql.js 内存中的数据库导出为字节，写入 IndexedDB */
async function saveToIdb(db: SqlJsDatabase): Promise<void> {
  const bytes = db.export()
  await idbSet(DB_KEY, bytes)
}

/** 每次写操作后延迟合并保存，避免频繁写入 */
function scheduleSave(): void {
  if (!activeDb) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveToIdb(activeDb!).catch((err) => console.error('[OneLedger] 保存数据失败：', err))
  }, 400)
}

/** 关页面前立刻把未保存的改动写入浏览器 */
function installAutoSave(db: SqlJsDatabase): void {
  const flush = () => {
    if (!saveTimer) return
    clearTimeout(saveTimer)
    saveTimer = null
    saveToIdb(db).catch((err) => console.error('[OneLedger] 保存数据失败：', err))
  }
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

/** 把 $1、$2… 参数转换成 sql.js 的命名绑定对象（即使参数在 SQL 中乱序出现也能正确对应） */
function toBindObject(params?: unknown[]): Record<string, number | string | null> | undefined {
  if (!params || params.length === 0) return undefined
  const obj: Record<string, number | string | null> = {}
  for (let i = 0; i < params.length; i++) {
    const v = params[i]
    obj[`$${i + 1}`] =
      v === null || typeof v === 'number' || typeof v === 'string'
        ? v
        : typeof v === 'boolean'
          ? v
            ? 1
            : 0
          : String(v)
  }
  return obj
}

/** 创建网页版数据库连接（浏览器内运行 SQLite，数据自动存到 IndexedDB） */
export async function createWebDbConnection(): Promise<DbConnection> {
  const db = await getSqlite()
  return {
    async execute(query, params) {
      const bind = toBindObject(params)
      if (bind) db.run(query, bind)
      else db.run(query)
      let lastInsertId: number | undefined
      if (/^\s*insert\s/i.test(query)) {
        const r = db.exec('SELECT last_insert_rowid() AS id')
        lastInsertId = r[0]?.values[0]?.[0] as number | undefined
      }
      const rowsAffected = db.getRowsModified()
      scheduleSave()
      return { rowsAffected, lastInsertId }
    },
    async select<T>(query: string, params?: unknown[]): Promise<T> {
      const bind = toBindObject(params)
      const stmt = db.prepare(query)
      try {
        if (bind) stmt.bind(bind)
        const rows: unknown[] = []
        while (stmt.step()) rows.push(stmt.getAsObject())
        return rows as T
      } finally {
        stmt.free()
      }
    },
  }
}
