import { useState, useEffect, useCallback, useMemo } from 'react'
import ExpenseList from '../components/ExpenseList'
import ExpenseForm from '../components/ExpenseForm'
import BudgetSetup from '../components/BudgetSetup'
import ConfirmDialog from '../components/ConfirmDialog'
import StatsPanel from '../components/StatsPanel'
import { TrendLineChart } from '../components/TrendChart'
import {
  listExpenses,
  deleteExpense,
  deleteExpensesByDate,
  deleteExpensesByCategory,
  updateExpense,
  getMonths,
  getBudget,
  getAllExpenses,
  expensesToCSV,
  addExpense,
  getTrendData,
} from '../data/database'
import { localDateString, localMonthString, formatMonth, getRangeDates } from '../data/dateUtils'
import { useCategories } from '../contexts/CategoryContext'
import type { Expense, Budget, TransactionType, RangeMode, TrendPoint } from '../data/types'

// 把趋势数据补齐为连续 N 个月（缺记录的月份补 0），保证折线不断档
function fillTrendGaps(data: TrendPoint[], months: number): TrendPoint[] {
  const map = new Map(data.map((d) => [d.month, d.total]))
  const result: TrendPoint[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: key, total: map.get(key) ?? 0 })
  }
  return result
}

// 时间范围选择器里的三个固定按钮（历史月份是单独的下拉框）
const RANGE_PILLS: { key: RangeMode; label: string }[] = [
  { key: 'week', label: '近一周' },
  { key: '30d', label: '近一月' },
  { key: 'month', label: '本月' },
]

export default function HomePage() {
  const { categories } = useCategories()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showForm, setShowForm] = useState(false)
  // 时间范围：近一周 / 近一月 / 本月（默认）/ 历史月份
  const [rangeMode, setRangeMode] = useState<RangeMode>('month')
  const [historyMonth, setHistoryMonth] = useState('') // 仅 rangeMode='history' 时有效
  const [months, setMonths] = useState<string[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudgetData] = useState<Budget | null>(null)
  const [showBudget, setShowBudget] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteDateTarget, setDeleteDateTarget] = useState<string | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<{ date: string; category_l1: string } | null>(null)
  const [showDateAdder, setShowDateAdder] = useState(false)
  const [addingDate, setAddingDate] = useState('')
  const [addedDates, setAddedDates] = useState<string[]>([])

  const thisMonth = localMonthString()

  // 当前时间范围的本地起止日期
  const range = useMemo(() => getRangeDates(rangeMode, historyMonth), [rangeMode, historyMonth])

  // 预算只在「本月 / 历史月份」显示；归属月份跟随所选月份
  const showBudgetPanel = rangeMode === 'month' || rangeMode === 'history'
  const budgetMonth = rangeMode === 'history' ? historyMonth : thisMonth
  const isThisMonth = rangeMode === 'month'

  // 卡片左上角标签 + 金额标签
  const rangeLabel =
    rangeMode === 'week' ? '近一周'
      : rangeMode === '30d' ? '近一月'
      : rangeMode === 'month' ? '本月'
      : formatMonth(historyMonth)
  const amountLabel =
    rangeMode === 'week' ? '近一周支出'
      : rangeMode === '30d' ? '近一月支出'
      : isThisMonth ? '本月支出' : '当月支出'

  // 加载列表（按时间范围筛选）+ 历史月份下拉数据
  const loadData = useCallback(async () => {
    try {
      const [data, m] = await Promise.all([
        listExpenses({ startDate: range.start, endDate: range.end }),
        getMonths(),
      ])
      setExpenses(data)
      setMonths(m)
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      setLoading(false)
    }
  }, [range])

  // 顶部趋势图固定近 12 个月，不随时间范围切换
  useEffect(() => {
    getTrendData(12).then(setTrendData).catch(console.error)
  }, [])

  // 预算（近一周/近一月不显示预算，置空）
  const refreshBudget = useCallback(() => {
    if (!showBudgetPanel) {
      setBudgetData(null)
      return
    }
    getBudget(budgetMonth).then(setBudgetData).catch(console.error)
  }, [showBudgetPanel, budgetMonth])

  useEffect(() => {
    refreshBudget()
  }, [refreshBudget])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 顶部趋势图补零
  const filledTrend = useMemo(() => fillTrendGaps(trendData, 12), [trendData])

  // 已有记录的日期集合（用于"添加日期"查重）— 只覆盖当前时间范围
  const existingDates = useMemo(() => new Set(expenses.map((e) => e.date)), [expenses])

  // 添加日期弹窗：按 Esc 关闭
  useEffect(() => {
    if (!showDateAdder) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDateAdder(false)
        setAddingDate('')
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [showDateAdder])

  const handleDelete = (expense: Expense) => {
    setDeleteTarget(expense)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteExpense(deleteTarget.id)
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      alert('删除失败：' + String(err))
      setDeleteTarget(null)
    }
  }

  const handleDeleteDate = (date: string) => {
    setDeleteDateTarget(date)
  }

  const confirmDeleteDate = async () => {
    if (!deleteDateTarget) return
    try {
      await deleteExpensesByDate(deleteDateTarget)
      setDeleteDateTarget(null)
      loadData()
    } catch (err) {
      alert('删除失败：' + String(err))
      setDeleteDateTarget(null)
    }
  }

  const handleDeleteCategory = (date: string, category_l1: string) => {
    setDeleteCategoryTarget({ date, category_l1 })
  }

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return
    try {
      await deleteExpensesByCategory(deleteCategoryTarget.date, deleteCategoryTarget.category_l1)
      setDeleteCategoryTarget(null)
      loadData()
    } catch (err) {
      alert('删除失败：' + String(err))
      setDeleteCategoryTarget(null)
    }
  }

  const handleUpdate = async (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType = 'expense') => {
    await updateExpense(id, {
      amount,
      category_l1: expenses.find((e) => e.id === id)?.category_l1 || '',
      category_l2,
      date: expenses.find((e) => e.id === id)?.date || '',
      note,
      payment_method,
      type,
    })
    loadData()
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    loadData()
    refreshBudget()
  }

  const handleFormCancel = () => {
    setShowForm(false)
  }

  // 卡片统计：expenses 已按时间范围筛选，直接汇总
  const expenseTotal = expenses
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0)

  const incomeTotal = expenses
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0)

  const recordCount = expenses.length

  // 预算进度
  const budgetPct = !!budget?.amount && budget.amount > 0
    ? Math.min((expenseTotal / budget.amount) * 100, 100)
    : 0
  const overBudget = showBudgetPanel && !!budget?.amount && budget.amount > 0 && expenseTotal > budget.amount
  const nearBudget = showBudgetPanel && !!budget?.amount && budget.amount > 0 && budgetPct >= 80 && !overBudget

  // 导出（导出全部记录，与时间范围无关）
  const handleExport = async () => {
    try {
      const all = await getAllExpenses()
      // 排序：按日期降序 → 按固定大类顺序 → 按创建时间升序（和列表显示一致）
      const categoryOrder = new Map(categories.map((c, i) => [c.name, i]))
      all.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        const aCat = categoryOrder.get(a.category_l1) ?? 99
        const bCat = categoryOrder.get(b.category_l1) ?? 99
        if (aCat !== bCat) return aCat - bCat
        return a.id - b.id
      })
      const csv = expensesToCSV(all)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `一笔_${localDateString()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('导出失败：' + String(err))
    }
  }

  return (
    <div>
      {/* 顶部全宽趋势图（近 12 个月，固定不变，不随范围切换） */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📈 近12月支出趋势</h3>
        <TrendLineChart data={filledTrend} height={260} />
      </div>

      {/* 左右两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ===== 左栏：蓝色概览卡 + 记账列表 ===== */}
        <div className="space-y-6">
          {/* 蓝色概览卡 */}
          <div className={`bg-gradient-to-br rounded-2xl p-5 text-white shadow-lg transition-all ${
            overBudget
              ? 'from-red-500 to-red-600 shadow-red-500/30'
              : nearBudget
              ? 'from-amber-500 to-amber-600 shadow-amber-500/30'
              : 'from-primary to-primary-dark shadow-primary/20'
          }`}>
            {/* 第一行：范围标签 + 导出 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm opacity-80">{rangeLabel}</span>
              <button
                onClick={handleExport}
                className="bg-white/20 hover:bg-white/30 text-xs rounded-lg px-2 py-1 transition-colors"
                title="导出为 CSV"
              >
                导出
              </button>
            </div>

            {/* 时间范围选择器 */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {RANGE_PILLS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setRangeMode(p.key)}
                  className={`text-xs rounded-lg px-2.5 py-1 transition-colors ${
                    rangeMode === p.key
                      ? 'bg-white/30 font-semibold'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <select
                value={rangeMode === 'history' ? historyMonth : ''}
                onChange={(e) => {
                  if (!e.target.value) return
                  setHistoryMonth(e.target.value)
                  setRangeMode('history')
                }}
                className={`text-xs rounded-lg px-2 py-1 border border-white/20 focus:outline-none ${
                  rangeMode === 'history'
                    ? 'bg-white/30 text-white'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                <option value="" className="text-slate-800">历史月份▾</option>
                {months.map((m) => (
                  <option key={m} value={m} className="text-slate-800">
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* 金额区域 */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm opacity-80 mb-1">{amountLabel}</div>
                <div className="text-3xl font-bold tabular-nums">
                  ¥{expenseTotal.toFixed(2)}
                </div>
                {incomeTotal > 0 && (
                  <div className="text-sm opacity-70 mt-1">
                    💰 收入 ¥{incomeTotal.toFixed(2)}
                  </div>
                )}
                <div className="text-sm opacity-60 mt-1">
                  共 {recordCount} 笔记录
                </div>
              </div>

              {/* 预算区域（仅本月/历史月份显示） */}
              {showBudgetPanel && (
                <div className="text-right">
                  <button
                    onClick={() => setShowBudget(true)}
                    className="text-xs bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    {budget?.amount ? '修改预算' : '设置预算'}
                  </button>
                  {budget?.amount && budget.amount > 0 && (
                    <div className="mt-2">
                      <div className="text-[11px] opacity-70">
                        预算 ¥{budget.amount.toFixed(0)}
                      </div>
                      <div className="w-24 h-1.5 bg-white/20 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            overBudget ? 'bg-white' : 'bg-white/70'
                          }`}
                          style={{ width: `${Math.min(budgetPct, 100)}%` }}
                        />
                      </div>
                      <div className={`text-[11px] mt-0.5 ${overBudget ? 'font-bold' : 'opacity-70'}`}>
                        {overBudget
                          ? `超支 ¥${(expenseTotal - budget.amount).toFixed(2)}`
                          : `剩余 ¥${(budget.amount - expenseTotal).toFixed(2)}`
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 超支提醒横幅 */}
          {overBudget && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="text-sm text-red-600 font-medium">
                {isThisMonth ? '本月' : '当月'}已超出预算 ¥{(expenseTotal - (budget?.amount || 0)).toFixed(2)}，请注意控制支出
              </span>
            </div>
          )}

          {/* 接近预算提醒横幅 */}
          {nearBudget && (
            <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <span className="text-lg">💡</span>
              <span className="text-sm text-amber-600 font-medium">
                {isThisMonth ? '本月' : '当月'}预算已使用 {budgetPct.toFixed(0)}%，剩余 ¥{((budget?.amount || 0) - expenseTotal).toFixed(2)}
              </span>
            </div>
          )}

          {/* 记录列表 */}
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">加载中...</div>
          ) : (
            <ExpenseList
              expenses={expenses}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onRefresh={loadData}
              extraDates={addedDates}
              onDeleteDate={handleDeleteDate}
              onDeleteCategory={handleDeleteCategory}
            />
          )}
        </div>

        {/* ===== 右栏：当月支出图 + 分类排行 ===== */}
        <div className="space-y-6">
          <StatsPanel
            startDate={range.start}
            endDate={range.end}
            title={rangeMode === 'week' ? '近7天支出' : rangeMode === '30d' ? '近30天支出' : '当月支出'}
          />
        </div>
      </div>

      {/* 添加日期按钮 */}
      <button
        onClick={() => { setAddingDate(localDateString()); setShowDateAdder(true) }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 hover:bg-primary-dark hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-20"
        title="添加日期"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* 日期添加弹窗 */}
      {showDateAdder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-5">添加日期</h2>
            <input
              type="date"
              value={addingDate}
              onChange={(e) => setAddingDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 mb-4"
              autoFocus
            />
            {addingDate && existingDates.has(addingDate) && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-sm">
                该日期已有记录，请选择没有记录的日期
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDateAdder(false); setAddingDate('') }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!addingDate) return
                  if (existingDates.has(addingDate)) return

                  // 查找所有默认小类，直接存入数据库
                  let savedAny = false
                  for (const cat of categories) {
                    const defaults = cat.children.filter(c => c.isDefault)
                    for (const sub of defaults) {
                      try {
                        await addExpense({
                          amount: sub.defaultAmount || 0,
                          category_l1: cat.name,
                          category_l2: sub.name,
                          date: addingDate,
                          note: sub.defaultNote || '',
                          payment_method: sub.defaultPaymentMethod || '',
                          type: sub.defaultType || 'expense',
                        })
                        savedAny = true
                      } catch (err) {
                        console.error('自动保存默认记录失败:', err)
                      }
                    }
                  }

                  // 如果没有默认小类，仍然把日期添加到列表中（空日期）
                  if (!savedAny) {
                    setAddedDates(prev => prev.includes(addingDate) ? prev : [...prev, addingDate])
                  }

                  setShowDateAdder(false)
                  setAddingDate('')
                  // 刷新数据，让新保存的记录显示出来
                  await loadData()
                }}
                disabled={!addingDate || existingDates.has(addingDate)}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <ExpenseForm
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* 预算设置弹窗 */}
      {showBudget && (
        <BudgetSetup
          month={budgetMonth}
          onClose={() => setShowBudget(false)}
          onSaved={() => { setShowBudget(false); refreshBudget() }}
        />
      )}

      {/* 删除确认弹窗（单条记录） */}
      {deleteTarget && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除这笔 ¥${deleteTarget.amount.toFixed(2)} 的「${deleteTarget.category_l2}」记录吗？`}
          confirmText="删除"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 删除确认弹窗（整天的数据） */}
      {deleteDateTarget && (
        <ConfirmDialog
          title="删除当天所有记录"
          message={`确定要删除 ${deleteDateTarget} 这一天所有消费记录吗？此操作不可撤销。`}
          confirmText="全部删除"
          danger
          onConfirm={confirmDeleteDate}
          onCancel={() => setDeleteDateTarget(null)}
        />
      )}

      {/* 删除确认弹窗（某个大类一整天的数据） */}
      {deleteCategoryTarget && (
        <ConfirmDialog
          title="删除分类记录"
          message={`确定要删除 ${deleteCategoryTarget.date} 当天「${deleteCategoryTarget.category_l1}」的所有消费记录吗？此操作不可撤销。`}
          confirmText="全部删除"
          danger
          onConfirm={confirmDeleteCategory}
          onCancel={() => setDeleteCategoryTarget(null)}
        />
      )}
    </div>
  )
}
