import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ExpenseList from '../components/ExpenseList'
import ConfirmDialog from '../components/ConfirmDialog'
import DatePicker from '../components/DatePicker'
import DateRangePicker from '../components/DateRangePicker'
import StatsPanel from '../components/StatsPanel'
import MonthOverview from '../components/MonthOverview'
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
  catKey,
  listLocks,
  setMonthLocked,
  setDayLocked,
} from '../data/database'
import { localDateString, localMonthString, formatMonth, getRangeDates, eachDay } from '../data/dateUtils'
import { useSettings } from '../contexts/SettingsContext'
import { useCategories } from '../contexts/CategoryContext'
import { useHomeFilter } from '../contexts/HomeFilterContext'
import type { Expense, ExpenseInput, Budget, TransactionType, RangeMode } from '../data/types'

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
    dailyFilter, setDailyFilter,
    selectedCats, setSelectedCats,
    showQuickAdd, setShowQuickAdd,
    clearFilters,
  } = useHomeFilter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  // 数据版本号：每次 loadData() 完成后自增。日历区 / 右栏统计面板用它做刷新信号，
  // 否则编辑/删除/新增后只有蓝色卡片（直接由 expenses 推导）会变，图表不重新查库。
  const [dataVersion, setDataVersion] = useState(0)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [budget, setBudgetData] = useState<Budget | null>(null)
  const [budgetDraft, setBudgetDraft] = useState('') // 预算内联文本框内容
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteDateTarget, setDeleteDateTarget] = useState<string | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<{ date: string; category_l1: string } | null>(null)
  const lastCommittedRef = useRef(0) // 上次成功保存的预算金额，用于识别原生上下箭头点击（整步 ±1000 跳变即保存）
  const budgetDraftRef = useRef('') // 预算输入框最新值（同步 state，供 onChange 判断「是否从上次保存值整步跳变」）
  const customPickerRef = useRef<HTMLDivElement>(null) // 自定义区间浮窗容器（点击外部自动收起）
  const customPickerButtonRef = useRef<HTMLButtonElement>(null) // 「自定义」按钮（点击自身只做开/关切换，不触发外部收起）
  // 同时更新 state 与 ref，保证 onChange 里总能读到上一次渲染后的值
  const setDraft = useCallback((v: string) => {
    budgetDraftRef.current = v
    setBudgetDraft(v)
  }, [])
  const [showDateAdder, setShowDateAdder] = useState(false)
  const [addingDate, setAddingDate] = useState('')
  const [addedDates, setAddedDates] = useState<string[]>([])
  // 需要主动展开的日期（快捷添加日期 / 点击日历某天后，列表里该天的记录自动展开）
  const [autoExpandDates, setAutoExpandDates] = useState<string[]>([])
  // ===== 日期锁（月锁 / 日锁两个独立属性，互不修改）=====
  const [lockedMonths, setLockedMonths] = useState<Set<string>>(new Set())
  const [lockedDays, setLockedDays] = useState<Set<string>>(new Set())
  // 列表搜索关键字（匹配金额 / 备注，子串匹配不区分大小写）
  const [searchQuery, setSearchQuery] = useState('')
  const searchActive = searchQuery.trim() !== ''

  const thisMonth = localMonthString()

  // 当前时间范围的本地起止日期
  const range = useMemo(() => getRangeDates(rangeMode, historyMonth, customRange), [rangeMode, historyMonth, customRange])

  // 预算只在「本月 / 上月 / 历史月份」有数据；其余模式（近一周/近一月/自定义）显示 -
  const showBudgetPanel = rangeMode === 'month' || rangeMode === 'lastMonth' || rangeMode === 'history'
  const budgetMonth = rangeMode === 'history' ? historyMonth : rangeMode === 'lastMonth' ? localMonthString(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)) : thisMonth

  // 折线图标题（当前时间范围标签，跟随范围选择器）
  const rangeLabel =
    rangeMode === 'week' ? '近一周'
      : rangeMode === '30d' ? '近一月'
      : rangeMode === 'month' ? '本月'
      : rangeMode === 'lastMonth' ? '上月'
      : rangeMode === 'custom' ? `${customRange.start.replace(/-/g, '/')} 至 ${customRange.end.replace(/-/g, '/')}`
      : formatMonth(historyMonth)

  // 日历选中的日期 = 「自定义」范围恰为单天时的那一天（点日历某天就是自定义选中该天，
  // 整页蓝色卡 / 列表 / 排行都联动；再点同一天回到本月）
  const selectedDay = rangeMode === 'custom' && customRange.start === customRange.end ? customRange.start : null
  const handleSelectDay = (day: string | null) => {
    setShowCustomPicker(false)
    if (day === null || day === selectedDay) {
      // 取消：回到本月视图
      setRangeMode('month')
      return
    }
    setCustomRange({ start: day, end: day })
    setRangeMode('custom')
    // 点击日历某天 → 主动展开当天记录，让用户直接看到该天的记账数据
    setAutoExpandDates((prev) => (prev.includes(day) ? prev : [...prev, day]))
  }

  // 时间范围对应的整月（本月 / 历史月份 / 上月），用于让日历跟随蓝色模块；非整月范围不强制
  const syncMonth =
    rangeMode === 'month' ? thisMonth
      : rangeMode === 'history' ? historyMonth
      : rangeMode === 'lastMonth' ? localMonthString(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))
      : null

  // 日历选月份 → 联动时间范围选择器（效果等同在蓝色模块里选「历史月份」该月；本月则选「本月」）
  const handleCalendarMonthChange = (month: string) => {
    setShowCustomPicker(false)
    if (month === thisMonth) {
      setRangeMode('month')
    } else {
      setHistoryMonth(month)
      setRangeMode('history')
    }
  }

  // 加载列表（按时间范围筛选）+ 历史月份下拉数据 + 锁状态
  const loadData = useCallback(async () => {
    try {
      const [data, m, locks] = await Promise.all([
        listExpenses({ startDate: range.start, endDate: range.end }),
        getMonths(),
        listLocks(),
      ])
      setExpenses(data)
      setMonths(m)
      setLockedMonths(new Set(locks.months))
      setLockedDays(new Set(locks.days))
      // 数据已刷新：自增版本号，通知日历区 / 右栏统计面板重新查库
      setDataVersion((v) => v + 1)
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      setLoading(false)
    }
  }, [range])

  // 某天是否锁定 = 月已锁 或 该天已锁（只要一个成立就是锁的）
  const isDayLocked = useCallback(
    (date: string) => lockedMonths.has(date.slice(0, 7)) || lockedDays.has(date),
    [lockedMonths, lockedDays]
  )
  // 某天是否被「整月锁」覆盖：整月锁生效时，日期行的锁按钮置灰，必须先解锁整月
  const isMonthLockedForDate = useCallback(
    (date: string) => lockedMonths.has(date.slice(0, 7)),
    [lockedMonths]
  )

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

  // 已有记录的日期集合（用于"添加日期"查重）— 只覆盖当前时间范围
  const existingDates = useMemo(() => new Set(expenses.map((e) => e.date)), [expenses])

  // 任何时间范围（近一周 / 近一月 / 本月 / 上月 / 历史月份 / 自定义）下缺失记录的日期——
  // 列表里为这些日期补「+ 添加」快捷行。缺的日期会一并落入某段缺失区间：[prev+1, next-1]，
  // 其中的两端（挨着已有日期）补快捷。
  // 有筛选（支付方式 / 分类 / 搜索）时不补缺失日期快捷行（列表聚焦筛选结果）
  const hasAnyFilter = !!paymentFilter || !!dailyFilter || selectedCats.size > 0 || searchActive
  const missingDates = useMemo(() => {
    if (hasAnyFilter) return []
    const existing = new Set(expenses.map((e) => e.date))
    const allDates = eachDay(range.start, range.end)
    // 已锁定的空白天不算「未记录」（走下面的「当天无消费」）
    return allDates.filter((d) => !existing.has(d) && !isDayLocked(d))
  }, [range, hasAnyFilter, expenses, isDayLocked])

  // 锁住的空白天 = 当天无消费（始终显示，不受「快捷添加」开关控制；筛选/搜索时隐藏以聚焦结果）
  const noSpendDates = useMemo(() => {
    if (hasAnyFilter) return []
    const existing = new Set(expenses.map((e) => e.date))
    return eachDay(range.start, range.end).filter((d) => !existing.has(d) && isDayLocked(d))
  }, [range, hasAnyFilter, expenses, isDayLocked])

  // 列表里的「纯日期分组」= 手动添加的空白日期 + 锁住的空白天（当天无消费）。
  // 必须 memo：ExpenseList 内部用 extraDates 的引用做「自动展开」effect，每次渲染都给新数组会死循环。
  const extraDatesForList = useMemo(
    () => (hasAnyFilter ? [] : [...new Set([...addedDates, ...noSpendDates])]),
    [hasAnyFilter, addedDates, noSpendDates]
  )

  // 逐天锁 / 解锁：整月锁生效时不允许（必须先解锁整月）
  const handleToggleDayLock = async (date: string) => {
    if (isMonthLockedForDate(date)) return
    const next = !lockedDays.has(date)
    try {
      await setDayLocked(date, next)
      setLockedDays((prev) => {
        const s = new Set(prev)
        if (next) s.add(date)
        else s.delete(date)
        return s
      })
    } catch (err) {
      alert('操作失败：' + String(err))
    }
  }

  /**
   * 整月锁 / 解锁（点一下就生效，不弹确认框 —— 锁错了再点一下解锁即可，数据可逆、无风险）。
   * ⚠️ 只写月锁属性，不会去改任何一天的日锁（两个属性互不修改）；
   * 解锁整月也只清月锁，之前单独锁过的天仍然锁着。
   */
  const handleToggleMonthLock = async (month: string) => {
    try {
      const next = !lockedMonths.has(month)
      await setMonthLocked(month, next)
      setLockedMonths((prev) => {
        const s = new Set(prev)
        if (next) s.add(month)
        else s.delete(month)
        return s
      })
    } catch (err) {
      alert('操作失败：' + String(err))
    }
  }

  // 快捷按钮要添加的日期 = 列表里所有日期（真实记录 + 手动添加的空白日期）的最大值 + 1 天。
  // 只在「本月」显示，且最大日期还没到这个月最后一天时才展示（可提前添加未来日期做计划；
  // 本月的查询范围已覆盖整个自然月，添加的未来日期会立刻显示在列表里）。

  // 自定义区间浮窗：点击非日历区域自动收起（Esc 同样关闭）
  useEffect(() => {
    if (!showCustomPicker) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      // 点击浮窗内部或「自定义」按钮本身都不算外部，不收起（按钮自身负责开/关切换）
      if (
        customPickerRef.current?.contains(target) ||
        customPickerButtonRef.current?.contains(target)
      ) {
        return
      }
      setShowCustomPicker(false)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCustomPicker(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [showCustomPicker])

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

  const handleUpdate = async (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType = 'expense', is_non_daily: boolean = false) => {
    await updateExpense(id, {
      amount,
      category_l1: expenses.find((e) => e.id === id)?.category_l1 || '',
      category_l2,
      date: expenses.find((e) => e.id === id)?.date || '',
      note,
      payment_method,
      type,
      is_non_daily,
    })
    loadData()
  }

  // 完整编辑（编辑弹窗）：全部字段含日期，日期录错可直接改对，无需删了重记
  const handleUpdateFull = async (id: number, input: ExpenseInput) => {
    await updateExpense(id, input)
    loadData()
  }

  // 保存某一天：只处理勾选了「默认」的大类，其下默认小类自动存成记录；
  // 没有默认小类的大类只加空白日期。右下角弹窗的「添加」和顶部快捷按钮共用此函数。
  const saveNewDate = async (date: string) => {
    // 锁定的日期完全只读：必须先解锁才能记账
    if (isDayLocked(date)) {
      alert(`${date} 已锁定，请先解锁后再记账`)
      return
    }
    let savedAny = false
    for (const cat of categories) {
      // 未勾选默认的大类不参与「添加某天」自动记账
      if (!cat.is_default) continue
      const defaults = cat.children.filter((c) => c.is_default)
      for (const sub of defaults) {
        try {
          await addExpense({
            amount: sub.default_amount || 0,
            category_l1: cat.name,
            category_l2: sub.name,
            date,
            note: sub.default_note || '',
            payment_method: sub.default_payment_method || '',
            type: sub.default_type || 'expense',
            is_non_daily: sub.default_is_non_daily,
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

    // 主动展开刚添加的日期（无论是否保存了记录），让用户直接看到该天的记账数据
    setAutoExpandDates((prev) => (prev.includes(date) ? prev : [...prev, date]))

    // 刷新数据，让新保存的记录显示出来
    await loadData()
  }

  // 卡片统计：expenses 已按时间范围筛选，直接汇总
  const expenseTotal = expenses
    .filter((e) => expenseCodes.has(e.type))
    .reduce((sum, e) => sum + e.amount, 0)

  const recordCount = expenses.length
  // 日常 / 非日常支出金额（只统计「计入支出」的记录，与卡片「支出」口径一致：日常 + 非日常 = 支出）
  const dailyTotal = expenses
    .filter((e) => expenseCodes.has(e.type) && !e.is_non_daily)
    .reduce((sum, e) => sum + e.amount, 0)
  const nonDailyTotal = expenses
    .filter((e) => expenseCodes.has(e.type) && e.is_non_daily)
    .reduce((sum, e) => sum + e.amount, 0)

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
    if (dailyFilter === 'daily') list = list.filter((e) => !e.is_non_daily)
    if (dailyFilter === 'nonDaily') list = list.filter((e) => e.is_non_daily)
    if (selectedCats.size > 0) list = list.filter((e) => selectedCats.has(catKey(e.category_l1, e.category_l2)))
    // 搜索：金额（原始数字或两位小数格式）与备注做不区分大小写的子串匹配
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((e) => {
        const note = (e.note || '').toLowerCase()
        if (note.includes(q)) return true
        return String(e.amount).includes(q) || e.amount.toFixed(2).includes(q)
      })
    }
    return list
  }, [expenses, paymentFilter, dailyFilter, selectedCats, searchQuery])

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
    setDraft(budget?.amount ? budget.amount.toFixed(0) : '')
    lastCommittedRef.current = budget?.amount ?? 0
  }, [budget, setDraft])

  // 内联文本框保存预算（回车、失焦、或点上下箭头时触发）
  const commitBudget = async (raw?: string) => {
    const draft = raw ?? budgetDraft
    const num = parseFloat(draft)
    if (isNaN(num) || num < 0) {
      // 非法输入，还原为当前预算值
      setDraft(budget?.amount ? budget.amount.toFixed(0) : '')
      return
    }
    if (num === 0) {
      // 0 视为未设置：删除当月预算记录，回到未设置状态
      try {
        await deleteBudget(budgetMonth)
        lastCommittedRef.current = 0
        setDraft('')
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
      {/* 📝 记账模块顶部：支出日历（2/5 宽）+ 右侧按天趋势图（3/5 宽，跟随范围选择器联动） */}
      <MonthOverview
        dataVersion={dataVersion}
        startDate={range.start}
        endDate={range.end}
        title={rangeLabel}
        selectedDay={selectedDay}
        onSelectDay={handleSelectDay}
        syncMonth={syncMonth}
        onMonthChange={handleCalendarMonthChange}
        lockedMonths={lockedMonths}
        lockedDays={lockedDays}
        onToggleMonthLock={handleToggleMonthLock}
      />

      {/* 左右两栏：左栏（蓝色概览卡 + 记账列表）占 3/5，右栏（分类排行）占 2/5 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ===== 左栏（3/5）：蓝色概览卡 + 记账列表 ===== */}
        <div className="lg:col-span-3 space-y-6">
          {/* 蓝色概览卡 */}
          <div className={`bg-gradient-to-br rounded-2xl p-5 text-white shadow-lg transition-all ${
            overBudget
              ? 'from-red-500 to-red-600 shadow-red-500/30'
              : nearBudget
              ? 'from-amber-500 to-amber-600 shadow-amber-500/30'
              : 'from-primary to-primary-dark shadow-primary/20'
          }`}>
            {/* 时间范围选择器 + 导出（一行，选中的按钮即标题） */}
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary bg-white rounded-full px-2.5 py-1 shadow-sm">💰 概览</span>
                {RANGE_PILLS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => {
                      setRangeMode(p.key)
                      setShowCustomPicker(false) // 切换其他时间范围时收起自定义面板
                    }}
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
                    setShowCustomPicker(false) // 切换历史月份时收起自定义面板
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
                  ref={customPickerButtonRef}
                  onClick={() => setShowCustomPicker((v) => !v)}
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

              {/* 自定义区间浮窗：悬浮在蓝色卡片上，点击外部自动收起 */}
              {showCustomPicker && (
                <div
                  ref={customPickerRef}
                  className="absolute left-0 right-0 top-full z-30 mt-2 bg-white rounded-xl p-4 text-slate-900 w-fit max-w-full overflow-x-auto shadow-xl border border-slate-100"
                >
                  <DateRangePicker
                    start={customRange.start}
                    end={customRange.end}
                    onChange={(range) => {
                      setCustomRange(range)
                      setRangeMode('custom')
                      // 自定义范围起止为同一天（单天视图）：与点击日历某天一致，主动展开当天的记录
                      if (range.start === range.end) {
                        setAutoExpandDates((prev) => (prev.includes(range.start) ? prev : [...prev, range.start]))
                      }
                    }}
                    onComplete={() => setShowCustomPicker(false)}
                    onCancel={() => setShowCustomPicker(false)}
                  />
                </div>
              )}
            </div>

            {/* 金额 + 预算（一行五份：支出（金额后直接接笔数）/日常/非日常/预算/剩余，按内容均布）+ 进度条 */}
            <div>
              <div className="flex items-center justify-between text-sm gap-2">
                {/* 支出：金额后直接接笔数 */}
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">支出</span>
                  <span className="font-bold tabular-nums">¥{expenseTotal.toFixed(2)}</span>
                  <span className="text-xs opacity-70">{recordCount}笔</span>
                </div>

                {/* 日常（只统计计入支出的日常记录金额；点击 = 筛选列表只看日常，类似支付方式筛选，再点取消） */}
                <button
                  type="button"
                  onClick={() => setDailyFilter(dailyFilter === 'daily' ? '' : 'daily')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 transition-colors ${
                    dailyFilter === 'daily'
                      ? 'bg-white text-primary font-semibold'
                      : dailyFilter
                      ? 'bg-white/10 hover:bg-white/25 opacity-50'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                  title={dailyFilter === 'daily' ? '取消筛选（当前只看日常）' : '筛选：只显示日常支出'}
                >
                  <span className={dailyFilter === 'daily' ? '' : 'opacity-80'}>日常</span>
                  <span className="font-semibold tabular-nums">¥{dailyTotal.toFixed(2)}</span>
                </button>

                {/* 非日常（同上，点击筛选列表只看非日常） */}
                <button
                  type="button"
                  onClick={() => setDailyFilter(dailyFilter === 'nonDaily' ? '' : 'nonDaily')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 transition-colors ${
                    dailyFilter === 'nonDaily'
                      ? 'bg-white text-primary font-semibold'
                      : dailyFilter
                      ? 'bg-white/10 hover:bg-white/25 opacity-50'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                  title={dailyFilter === 'nonDaily' ? '取消筛选（当前只看非日常）' : '筛选：只显示非日常支出'}
                >
                  <span className={dailyFilter === 'nonDaily' ? '' : 'opacity-80'}>非日常</span>
                  <span className="font-semibold tabular-nums">¥{nonDailyTotal.toFixed(2)}</span>
                </button>

                {/* 预算（近一周/近一月无预算月份，显示 -；其余模式原生上下箭头 ±1000，点箭头即保存） */}
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">预算</span>
                  {showBudgetPanel ? (
                    <input
                      type="number"
                      min="0"
                      step={1000}
                      value={budgetDraft}
                      onChange={(e) => {
                        const v = e.target.value
                        const num = parseFloat(v)
                        const last = lastCommittedRef.current
                        // 点原生上下箭头：值从「上次保存值」整步跳变（±1000），立即保存；
                        // 打字逐字符变化不会整步跳变（如从 0 敲出 "1000"，中间值是 1/10/100，
                        // 与上次保存值不同），仍由回车/失焦保存。
                        const prevDraft = budgetDraftRef.current
                        const fromLast = prevDraft === ''
                          ? last === 0
                          : parseFloat(prevDraft) === last
                        setDraft(v)
                        if (
                          !isNaN(num) &&
                          (num === last + 1000 || num === last - 1000) &&
                          fromLast
                        ) {
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
                          setDraft(String(next))
                          commitBudget(String(next))
                        }
                      }}
                      placeholder="未设置"
                      className="w-16 bg-white/20 rounded-md px-1 py-0.5 font-semibold tabular-nums placeholder-white/50 focus:bg-white/30 focus:outline-none"
                    />
                  ) : (
                    <span className="font-semibold tabular-nums">-</span>
                  )}
                </div>

                {/* 剩余（未设置预算显示 -；接近/超出预算时底色变色提示） */}
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="opacity-80">剩余</span>
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
              {/* 记账列表标题 + 搜索框 + 快捷添加开关（开关关闭时隐藏缺失日期的「+ 添加」快捷行） */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-100/90 rounded-full px-2.5 h-9">📝 记账列表</span>
                <div className="relative flex-1 min-w-0">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索金额或备注"
                  className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="清空搜索"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
                {/* 快捷添加开关：控制缺失日期「+ 添加」快捷行的显隐（悬浮气泡说明显示条件与功能；
                    原生 title 在 Tauri WebView 不显示，沿用黄历卡的自定义气泡方案；
                    任一筛选（支付方式/日常/分类/搜索）生效时快捷行不显示，按钮整体置灰不可点） */}
                <div className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={() => !hasAnyFilter && setShowQuickAdd((v) => !v)}
                    disabled={hasAnyFilter}
                    className={`flex items-center gap-1.5 text-xs font-medium rounded-full h-9 px-2.5 border transition-colors ${
                      hasAnyFilter
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : showQuickAdd
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className={`relative inline-flex w-7 h-4 rounded-full transition-colors ${hasAnyFilter ? 'bg-slate-200' : showQuickAdd ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showQuickAdd && !hasAnyFilter ? 'translate-x-3' : ''}`} />
                    </span>
                    快捷添加
                  </button>
                  {/* 悬浮说明气泡：点击开关切换显示/隐藏，下方两行说明功能与显示条件（w-max + nowrap 保证每行完整单行展示） */}
                  <div className="pointer-events-none absolute right-0 top-full mt-2 z-30 hidden group-hover:block w-max whitespace-nowrap bg-slate-800/95 text-white text-xs leading-relaxed rounded-lg px-3 py-2.5 shadow-lg">
                    <div>为当前时间范围内没有记录的日期补「+添加」快捷行。</div>
                    <div className="mt-1.5">已锁定（确认）的空白天会显示为「当天无消费」，始终可见。</div>
                    <div className="mt-1.5">开启支付方式/日常/分类筛选或搜索时无效。</div>
                  </div>
                </div>
              </div>
              <ExpenseList
                expenses={filteredExpenses}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onUpdateFull={handleUpdateFull}
                onRefresh={loadData}
                extraDates={extraDatesForList}
                autoExpandDates={autoExpandDates}
                missingDates={showQuickAdd ? missingDates : []}
                onAddDate={saveNewDate}
                onDeleteDate={handleDeleteDate}
                onDeleteCategory={handleDeleteCategory}
                hasFilter={!!paymentFilter || !!dailyFilter || hasCategoryFilter || searchActive}
                searchActive={searchActive}
                lockedMonths={lockedMonths}
                lockedDays={lockedDays}
                onToggleDayLock={handleToggleDayLock}
              />
            </div>
          )}
        </div>

        {/* ===== 右栏（2/5）：分类排行（当月支出图已移到顶部日历区） ===== */}
        <div className="lg:col-span-2 space-y-6">
          <StatsPanel
            startDate={range.start}
            endDate={range.end}
            dataVersion={dataVersion}
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
            {addingDate && isDayLocked(addingDate) && (
              <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-sm">
                该日期已锁定（{isMonthLockedForDate(addingDate) ? '整月已锁定' : '当天已锁定'}），请先解锁后再记账
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
                  if (isDayLocked(addingDate)) return
                  setShowDateAdder(false)
                  setAddingDate('')
                  await saveNewDate(addingDate)
                }}
                disabled={!addingDate || existingDates.has(addingDate) || isDayLocked(addingDate)}
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
