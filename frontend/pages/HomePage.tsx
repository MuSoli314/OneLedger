import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ExpenseList from '../components/ExpenseList'
import ConfirmDialog from '../components/ConfirmDialog'
import DatePicker from '../components/DatePicker'
import DateRangePicker from '../components/DateRangePicker'
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
  setBudget,
  deleteBudget,
  getAllExpenses,
  expensesToCSV,
  addExpense,
  getTrendData,
  catKey,
} from '../data/database'
import { localDateString, localMonthString, formatMonth, getRangeDates, eachDay } from '../data/dateUtils'
import { useSettings } from '../contexts/SettingsContext'
import { useCategories } from '../contexts/CategoryContext'
import { useHomeFilter } from '../contexts/HomeFilterContext'
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

// 时间范围选择器里的固定按钮（历史月份和自定义是单独控件）
const RANGE_PILLS: { key: RangeMode; label: string }[] = [
  { key: 'week', label: '近一周' },
  { key: '30d', label: '近一月' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
]

export default function HomePage() {
  const { categories } = useCategories()
  const { paymentMethods, txTypes, expenseCodes } = useSettings()
  const {
    rangeMode, setRangeMode,
    historyMonth, setHistoryMonth,
    customRange, setCustomRange,
    paymentFilter, setPaymentFilter,
    selectedCats, setSelectedCats,
    trendCategory, setTrendCategory,
    clearFilters,
  } = useHomeFilter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  // 数据版本号：每次 loadData() 完成后自增。右栏统计面板 / 顶部趋势图用它做刷新信号，
  // 否则编辑/删除/新增后只有蓝色卡片（直接由 expenses 推导）会变，图表不重新查库。
  const [dataVersion, setDataVersion] = useState(0)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [months, setMonths] = useState<string[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudgetData] = useState<Budget | null>(null)
  const [budgetDraft, setBudgetDraft] = useState('') // 预算内联文本框内容
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteDateTarget, setDeleteDateTarget] = useState<string | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<{ date: string; category_l1: string } | null>(null)
  const lastCommittedRef = useRef(0) // 上次成功保存的预算金额，用于识别原生上下箭头点击（整步 ±1000 跳变即保存）
  const [showDateAdder, setShowDateAdder] = useState(false)
  const [addingDate, setAddingDate] = useState('')
  const [addedDates, setAddedDates] = useState<string[]>([])

  const thisMonth = localMonthString()

  // 当前时间范围的本地起止日期
  const range = useMemo(() => getRangeDates(rangeMode, historyMonth, customRange), [rangeMode, historyMonth, customRange])

  // 预算只在「本月 / 上月 / 历史月份」有数据；其余模式（近一周/近一月/自定义）显示 -
  const showBudgetPanel = rangeMode === 'month' || rangeMode === 'lastMonth' || rangeMode === 'history'
  const budgetMonth = rangeMode === 'history' ? historyMonth : rangeMode === 'lastMonth' ? localMonthString(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)) : thisMonth

  // 卡片左上角标签 + 金额标签
  const rangeLabel =
    rangeMode === 'week' ? '近一周'
      : rangeMode === '30d' ? '近一月'
      : rangeMode === 'month' ? '本月'
      : rangeMode === 'lastMonth' ? '上月'
      : rangeMode === 'custom' ? `${customRange.start.replace(/-/g, '/')} 至 ${customRange.end.replace(/-/g, '/')}`
      : formatMonth(historyMonth)

  // 加载列表（按时间范围筛选）+ 历史月份下拉数据
  const loadData = useCallback(async () => {
    try {
      const [data, m] = await Promise.all([
        listExpenses({ startDate: range.start, endDate: range.end }),
        getMonths(),
      ])
      setExpenses(data)
      setMonths(m)
      // 数据已刷新：自增版本号，通知统计面板 / 趋势图重新查库
      setDataVersion((v) => v + 1)
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      setLoading(false)
    }
  }, [range])

  // 顶部趋势图固定近 12 个月，不随时间范围切换；可按大类筛选（随 trendCategory 变化）。
  // dataVersion 变化时重新查库，保证编辑/删除后图表同步刷新
  useEffect(() => {
    getTrendData(12, trendCategory || undefined).then(setTrendData).catch(console.error)
  }, [trendCategory, dataVersion])

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

  // 整月视图（本月/上月/历史月份）下缺失记录的日期——列表里为这些日期补「+ 添加」快捷行。
  // 缺的日期会一并落入某段缺失区间：[prev+1, next-1]，其中的两端（挨着已有日期）补快捷。
  // 展示条件与原有「添加下一天」一致：按了支付方式 / 分类筛选时不补快捷（列表聚焦筛选结果）。
  const monthRange = (rangeMode === 'month' || rangeMode === 'lastMonth' || rangeMode === 'history') ? range : null
  const hasAnyFilter = !!paymentFilter || selectedCats.size > 0
  const missingDates = useMemo(() => {
    if (!monthRange || hasAnyFilter) return []
    const existing = new Set(expenses.map((e) => e.date))
    const allDates = eachDay(monthRange.start, monthRange.end)
    return allDates.filter((d) => !existing.has(d))
  }, [monthRange, hasAnyFilter, expenses])

  // 快捷按钮要添加的日期 = 列表里所有日期（真实记录 + 手动添加的空白日期）的最大值 + 1 天。
  // 只在「本月」显示，且最大日期还没到这个月最后一天时才展示（可提前添加未来日期做计划；
  // 本月的查询范围已覆盖整个自然月，添加的未来日期会立刻显示在列表里）。

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

  const handleUpdate = async (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType = 'expense', isNonDaily: boolean = false) => {
    await updateExpense(id, {
      amount,
      category_l1: expenses.find((e) => e.id === id)?.category_l1 || '',
      category_l2,
      date: expenses.find((e) => e.id === id)?.date || '',
      note,
      payment_method,
      type,
      isNonDaily,
    })
    loadData()
  }

  // 保存某一天：只处理勾选了「默认」的大类，其下默认小类自动存成记录；
  // 没有默认小类的大类只加空白日期。右下角弹窗的「添加」和顶部快捷按钮共用此函数。
  const saveNewDate = async (date: string) => {
    let savedAny = false
    for (const cat of categories) {
      // 未勾选默认的大类不参与「添加某天」自动记账
      if (!cat.isDefault) continue
      const defaults = cat.children.filter((c) => c.isDefault)
      for (const sub of defaults) {
        try {
          await addExpense({
            amount: sub.defaultAmount || 0,
            category_l1: cat.name,
            category_l2: sub.name,
            date,
            note: sub.defaultNote || '',
            payment_method: sub.defaultPaymentMethod || '',
            type: sub.defaultType || 'expense',
            isNonDaily: sub.defaultIsNonDaily,
          })
          savedAny = true
        } catch (err) {
          console.error('自动保存默认记录失败:', err)
        }
      }
    }

    // 如果没有默认小类，仍然把日期添加到列表中（空日期）
    if (!savedAny) {
      setAddedDates((prev) => (prev.includes(date) ? prev : [...prev, date]))
    }

    // 刷新数据，让新保存的记录显示出来
    await loadData()
  }

  // 卡片统计：expenses 已按时间范围筛选，直接汇总
  const expenseTotal = expenses
    .filter((e) => expenseCodes.has(e.type))
    .reduce((sum, e) => sum + e.amount, 0)

  const recordCount = expenses.length

  // 是否正在按分类筛选
  const hasCategoryFilter = selectedCats.size > 0

  // 勾选某大类：等于选中它下面的所有小类；再次点击（小类全部已选时）整类取消
  const toggleCategory = useCallback((l1: string, l2s: string[]) => {
    setSelectedCats((prev) => {
      const next = new Set(prev)
      if (l2s.every((l2) => next.has(catKey(l1, l2)))) {
        for (const l2 of l2s) next.delete(catKey(l1, l2))
      } else {
        for (const l2 of l2s) next.add(catKey(l1, l2))
      }
      return next
    })
  }, [setSelectedCats])

  // 勾选某小类：单独选中/取消
  const toggleSubCategory = useCallback((l1: string, l2: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev)
      const k = catKey(l1, l2)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [setSelectedCats])

  // 判断某小类是否被选中（用于复选框勾选态 + 列表筛选）
  const isCatSelected = useCallback(
    (l1: string, l2: string) => selectedCats.has(catKey(l1, l2)),
    [selectedCats]
  )

  // 分类筛选后的列表（勾选的每个小类都保留；大小类筛选与支付方式筛选叠加生效）
  const filteredExpenses = useMemo(() => {
    let list = expenses
    if (paymentFilter) list = list.filter((e) => (e.payment_method || '未设置') === paymentFilter)
    if (selectedCats.size > 0) list = list.filter((e) => selectedCats.has(catKey(e.category_l1, e.category_l2)))
    return list
  }, [expenses, paymentFilter, selectedCats])

  // 支付方式统计（只统计支出，与卡片总支出 ¥expenseTotal 口径一致；金额按从高到低排序）
  const paymentTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) {
      if (!expenseCodes.has(e.type)) continue
      const key = e.payment_method || '未设置'
      map.set(key, (map.get(key) ?? 0) + e.amount)
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, expenseCodes])

  // 预算进度
  const budgetPct = !!budget?.amount && budget.amount > 0
    ? Math.min((expenseTotal / budget.amount) * 100, 100)
    : 0
  const overBudget = showBudgetPanel && !!budget?.amount && budget.amount > 0 && expenseTotal > budget.amount
  const nearBudget = showBudgetPanel && !!budget?.amount && budget.amount > 0 && budgetPct >= 80 && !overBudget
  const remaining = (budget?.amount || 0) - expenseTotal

  // 预算加载后同步到内联文本框 + 记录已保存金额（用于识别原生上下箭头点击）
  useEffect(() => {
    setBudgetDraft(budget?.amount ? budget.amount.toFixed(0) : '')
    lastCommittedRef.current = budget?.amount ?? 0
  }, [budget])

  // 内联文本框保存预算（回车、失焦、或点上下箭头时触发）
  const commitBudget = async (raw?: string) => {
    const draft = raw ?? budgetDraft
    const num = parseFloat(draft)
    if (isNaN(num) || num < 0) {
      // 非法输入，还原为当前预算值
      setBudgetDraft(budget?.amount ? budget.amount.toFixed(0) : '')
      return
    }
    if (num === 0) {
      // 0 视为未设置：删除当月预算记录，回到未设置状态
      try {
        await deleteBudget(budgetMonth)
        lastCommittedRef.current = 0
        setBudgetDraft('')
        refreshBudget()
      } catch (err) {
        alert('预算保存失败：' + String(err))
      }
      return
    }
    try {
      await setBudget(budgetMonth, Math.round(num * 100) / 100)
      lastCommittedRef.current = num
      refreshBudget()
    } catch (err) {
      alert('预算保存失败：' + String(err))
    }
  }

  // 原生上下箭头的点击已由输入框 onChange 里的「整步跳变检测」（±1000）立即保存，
  // 不再单独监听 change 事件；打字逐字符变化仍走回车/失焦保存。

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
      const csv = expensesToCSV(all, txTypes)
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
      {/* 顶部全宽趋势图（近 12 个月，固定不变，不随范围切换；可下拉筛选某大类） */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-700">📈 近12月支出趋势</h3>
          <select
            value={trendCategory}
            onChange={(e) => setTrendCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-primary"
          >
            <option value="">📊 全天</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
        <TrendLineChart
          data={filledTrend}
          color={trendCategory ? '#f59e0b' : '#6366f1'}
          height={260}
        />
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
            {/* 时间范围选择器 + 导出（一行，选中的按钮即标题） */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
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
                <button
                  onClick={() => setShowCustomPicker(true)}
                  className={`w-48 whitespace-nowrap text-center text-xs rounded-lg px-2.5 py-1 transition-colors ${
                    rangeMode === 'custom'
                      ? 'bg-white/30 font-semibold'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {rangeMode === 'custom'
                    ? `${customRange.start.replace(/-/g, '/')} 至 ${customRange.end.replace(/-/g, '/')}`
                    : '自定义'}
                </button>
                <button
                  onClick={handleExport}
                  className="bg-white/20 hover:bg-white/30 text-xs rounded-lg px-2 py-1 transition-colors"
                  title="导出为 CSV"
                >
                  导出
                </button>
            </div>

            {showCustomPicker && (
              <div className="bg-white rounded-xl p-4 mb-4 text-slate-900 w-fit max-w-full overflow-x-auto">
                <DateRangePicker
                  start={customRange.start}
                  end={customRange.end}
                  onChange={(range) => {
                    setCustomRange(range)
                    setRangeMode('custom')
                  }}
                  onComplete={() => setShowCustomPicker(false)}
                  onCancel={() => setShowCustomPicker(false)}
                />
              </div>
            )}

            {/* 金额 + 预算（一行四块：支出/笔数/预算/剩余各占 1/4）+ 进度条 */}
            <div>
              <div className="flex items-center text-sm">
                {/* 支出：占 1/4 */}
                <div className="w-1/4 shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">支出：</span>
                  <span className="font-bold tabular-nums">¥{expenseTotal.toFixed(2)}</span>
                </div>

                {/* 笔数：占 1/4 */}
                <div className="w-1/4 shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">笔数：</span>
                  <span className="font-semibold tabular-nums">{recordCount}</span>
                </div>

                {/* 预算：占 1/4（近一周/近一月无预算月份，显示 -；其余模式原生上下箭头 ±1000，点箭头即保存） */}
                <div className="w-1/4 shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">预算：</span>
                  {showBudgetPanel ? (
                    <input
                      type="number"
                      min="0"
                      step={1000}
                      value={budgetDraft}
                      onChange={(e) => {
                        const v = e.target.value
                        setBudgetDraft(v)
                        // 点原生上下箭头：值按 step 整步跳变（±1000），立即保存；
                        // 打字逐字符变化不会整步跳变，仍由回车/失焦保存。
                        const num = parseFloat(v)
                        const last = lastCommittedRef.current
                        if (!isNaN(num) && (num === last + 1000 || num === last - 1000)) {
                          commitBudget(v)
                        }
                      }}
                      onBlur={(e) => commitBudget(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        // 键盘上下方向键：±1000 步进，松手/回车后保存
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          const cur = parseFloat(budgetDraft)
                          const base = isNaN(cur) || cur < 0 ? 0 : cur
                          const next = e.key === 'ArrowUp' ? base + 1000 : Math.max(0, base - 1000)
                          setBudgetDraft(String(next))
                          commitBudget(String(next))
                        }
                      }}
                      placeholder="未设置"
                      className="w-16 bg-white/20 rounded-md px-1 py-0.5 font-semibold tabular-nums placeholder-white/50 focus:bg-white/30 focus:outline-none"
                    />
                  ) : (
                    <span className="w-16 text-center font-semibold tabular-nums">-</span>
                  )}
                </div>

                {/* 剩余：占 1/4（未设置预算显示 -；接近/超出预算时底色变色提示） */}
                <div className="w-1/4 shrink-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">剩余：</span>
                  <span className={`font-semibold tabular-nums rounded-md px-1.5 py-0.5 transition-colors ${
                    overBudget
                      ? 'bg-white text-red-600'
                      : nearBudget
                      ? 'bg-white text-amber-600'
                      : 'bg-white/20'
                  }`}>
                    {budget?.amount && budget.amount > 0 ? `¥${remaining.toFixed(2)}` : '-'}
                  </span>
                </div>
              </div>

              {/* 进度条（设置了预算才显示） */}
              {showBudgetPanel && !!budget?.amount && budget.amount > 0 && (
                <div className="mt-2.5 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      overBudget ? 'bg-white' : 'bg-white/70'
                    }`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* 支付方式统计（无标题；每个支付方式占 1/3，格式：icon 名称 ¥金额 占比%；点击筛选下方列表，再点取消） */}
            {paymentTotals.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/20">
                <div className="grid grid-cols-3 gap-1.5">
                  {paymentTotals.map(({ name, total }) => {
                    const icon = paymentMethods.find((p) => p.name === name)?.icon || '💳'
                    const pct = expenseTotal > 0 ? (total / expenseTotal) * 100 : 0
                    const active = paymentFilter === name
                    return (
                      <button
                        key={name}
                        onClick={() => setPaymentFilter(active ? '' : name)}
                        className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap overflow-hidden transition-colors ${
                          active
                            ? 'bg-white text-primary font-semibold'
                            : paymentFilter
                            ? 'bg-white/10 hover:bg-white/25 opacity-50'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                        title={`${name}：¥${total.toFixed(2)}（${pct.toFixed(1)}%）${active ? '，点击取消筛选' : '，点击筛选'}`}
                      >
                        <span className={active ? '' : 'text-white/90'}>{icon} {name}</span>
                        <span className="font-semibold tabular-nums">¥{total.toFixed(2)}</span>
                        <span className={active ? 'text-primary/60' : 'text-white/50'}>{pct.toFixed(1)}%</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 记录列表 */}
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">加载中...</div>
          ) : (
            <div className="space-y-4">
              <ExpenseList
                expenses={filteredExpenses}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onRefresh={loadData}
                extraDates={addedDates}
                missingDates={missingDates}
                onAddDate={saveNewDate}
                onDeleteDate={handleDeleteDate}
                onDeleteCategory={handleDeleteCategory}
                hasFilter={!!paymentFilter || hasCategoryFilter}
              />
            </div>
          )}
        </div>

        {/* ===== 右栏：当月支出图 + 分类排行 ===== */}
        <div className="space-y-6">
          <StatsPanel
            startDate={range.start}
            endDate={range.end}
            dataVersion={dataVersion}
            title={rangeLabel}
            selectedCats={selectedCats}
            isCatSelected={isCatSelected}
            onToggleCategory={toggleCategory}
            onToggleSubCategory={toggleSubCategory}
            onClearFilters={clearFilters}
            paymentFilter={paymentFilter}
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
            <DatePicker value={addingDate} onChange={setAddingDate} inline />
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
                  setShowDateAdder(false)
                  setAddingDate('')
                  await saveNewDate(addingDate)
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
