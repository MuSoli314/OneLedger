// 记账列表主组件：日期分组 + 缺失日期快捷行 + 行内编辑状态管理 + 完整编辑弹窗
// （单条记录行 / 大类分组 / 添加弹层 / 支付方式统计已拆到独立组件）
import { useState, useRef, useEffect } from 'react'
import EditExpenseDialog from './EditExpenseDialog'
import PaymentMethodTotals from './PaymentMethodTotals'
import CategoryAddPopover from './CategoryAddPopover'
import ExpenseCategoryGroup from './ExpenseCategoryGroup'
import HoverTip from './HoverTip'
import { useSettings } from '../contexts/SettingsContext'
import { addExpense } from '../data/database'
import { evaluateExpression } from '../data/calcUtils'
import { useCategories } from '../contexts/CategoryContext'
import { formatDate, getWeekday } from '../data/dateUtils'
import type { Expense, ExpenseInput, TransactionType } from '../data/types'
import type { LocalRow, EditField, EditForm } from './expenseListTypes'

interface Props {
  expenses: Expense[]
  onDelete: (expense: Expense) => void
  onUpdate: (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType, is_non_daily: boolean) => Promise<void>
  /** 完整编辑（编辑弹窗）：全部字段含日期，input 直接为入库格式 */
  onUpdateFull: (id: number, input: ExpenseInput) => Promise<void>
  onRefresh?: () => void
  extraDates?: string[]
  /** 需要主动展开的日期（快捷添加日期 / 点击日历某天后，自动展开该天记录） */
  autoExpandDates?: string[]
  /** 当前时间范围下缺失记录的日期（任何范围：近一周/近一月/本月/上月/历史月份/自定义）— 列表里为这些日期补「+ 添加」快捷行 */
  missingDates?: string[]
  /** 点击「+ 添加」快捷行时回调（新增该缺失日期，行为与「添加日期」弹窗一致） */
  onAddDate?: (date: string) => void
  onDeleteDate?: (date: string) => void
  onDeleteCategory?: (date: string, category_l1: string) => void
  // 是否正在筛选（支付方式/分类），仅影响空状态文案
  hasFilter?: boolean
  /** 搜索中：强制展开所有日期分组与大类分组，让命中的记录（含备注）直接可见 */
  searchActive?: boolean
  /** 月锁集合（YYYY-MM）：某月已锁 → 该月每天都是锁定的（含未来日期） */
  lockedMonths?: Set<string>
  /** 日锁集合（YYYY-MM-DD） */
  lockedDays?: Set<string>
  /** 点击日期行的锁按钮：锁 / 解锁当天（整月锁生效时不会触发） */
  onToggleDayLock?: (date: string) => void
}

/**
 * 把一组日期切成「连续段」并算出渲染布局（未记账快捷行 / 当天无消费行共用）。
 *
 * 折叠规则：段长 ≤3 全部显示；段长 >3 只显示最早、最晚两天，中间折成「+ 更多（N 天）」。
 * 展开状态存在 expandedRuns 里（key = runId）；两套段用 prefix 区分，展开状态互不影响。
 *
 * @param dates 倒序排列的日期（YYYY-MM-DD，与列表整体顺序一致）
 * @param prefix runId 前缀（q = 未记账段、n = 当天无消费段）
 * @param expandedRuns 已展开段的 runId 集合
 * @param out.visible 需要渲染的日期集合（没进这个集合的日期不渲染）
 * @param out.folded 折叠段：段内最早日期 → { runId, count, noSpend }
 * @param out.expandedMin / out.expandedMax 展开段的「收起」按钮位置（段尾 / 段首各一个）
 * @param noSpend 该批日期是否属于「当天无消费」（只影响折叠行文案）
 */
function collectRunLayout(
  dates: string[],
  prefix: string,
  expandedRuns: Set<string>,
  out: {
    visible: Set<string>
    folded: Map<string, { runId: string; count: number; noSpend: boolean }>
    expandedMin: Map<string, { runId: string }>
    expandedMax: Map<string, { runId: string }>
  },
  noSpend = false,
) {
  // 按「相邻差 1 天」切段
  const runs: string[][] = []
  for (const d of dates) {
    const last = runs[runs.length - 1]
    if (!last) {
      runs.push([d])
      continue
    }
    const gap = Math.abs(new Date(`${last[last.length - 1]}T00:00:00`).getTime() - new Date(`${d}T00:00:00`).getTime())
    if (gap === 86400000) last.push(d)
    else runs.push([d])
  }
  // 段内按时间升序；段之间按最晚日期倒序（与列表整体倒序一致）
  runs.forEach((r) => r.sort((a, b) => a.localeCompare(b)))
  runs.sort((a, b) => b[b.length - 1].localeCompare(a[a.length - 1]))

  for (const r of runs) {
    const min = r[0]
    const max = r[r.length - 1]
    if (r.length <= 3) {
      // 段长 ≤3：全部显示，不折叠
      for (const d of r) out.visible.add(d)
      continue
    }
    const runId = `${prefix}:${min}~${max}`
    if (expandedRuns.has(runId)) {
      // 已展开：全部显示，两端各放一个「收起」
      for (const d of r) out.visible.add(d)
      out.expandedMin.set(min, { runId })
      out.expandedMax.set(max, { runId })
    } else {
      // 折叠：只显示两端，中间折成「+ 更多（N 天）」
      out.visible.add(min)
      out.visible.add(max)
      out.folded.set(min, { runId, count: r.length - 2, noSpend })
    }
  }
}

export default function ExpenseList({ expenses, onDelete, onUpdate, onUpdateFull, onRefresh, extraDates, autoExpandDates, missingDates, onAddDate, onDeleteDate, onDeleteCategory, hasFilter, searchActive, lockedMonths, lockedDays, onToggleDayLock }: Props) {
  const { categories, addSubCategory, addCategory } = useCategories()
  const { paymentMethods, txTypes, defaultExpenseCode } = useSettings()
  const [collapsedMap, setCollapsedMap] = useState<Set<string>>(new Set())
  // 日期折叠 — 默认全部折叠（空 Set = 没有展开的日期）
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  // 连续缺失段（>3 天折叠成「+ 更多」）的展开状态 — 空 Set = 全部折叠
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set())

  // 自动展开手动添加的日期
  useEffect(() => {
    if (extraDates && extraDates.length > 0) {
      setExpandedDates(prev => {
        const next = new Set(prev)
        for (const d of extraDates) next.add(d)
        return next
      })
    }
  }, [extraDates])

  // 主动展开指定日期（快捷添加日期 / 点击日历某天）— 只展开「新出现」的日期，
  // 用户手动折叠过的旧日期不会被后续新增日期连带重新展开
  const lastAutoExpandRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const next = new Set(autoExpandDates || [])
    const added: string[] = []
    for (const d of next) {
      if (!lastAutoExpandRef.current.has(d)) added.push(d)
    }
    lastAutoExpandRef.current = next
    if (added.length === 0) return
    setExpandedDates(prev => {
      const s = new Set(prev)
      for (const d of added) s.add(d)
      return s
    })
  }, [autoExpandDates])

  const toggleDateCollapse = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  // 展开/收起连续缺失段（「+ 更多」）
  const toggleRunCollapse = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  const getDefaultSubs = (l1: string) => {
    return categories.find((c) => c.name === l1)?.children.filter((c) => c.is_default) || []
  }

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ category_l2: '', note: '', amount: '', payment_method: '', type: 'expense' as TransactionType, is_non_daily: false })
  // 进入编辑时聚焦哪个字段（点哪个格子聚焦哪个）
  const [focusField, setFocusField] = useState<EditField | null>(null)
  const [addingDate, setAddingDate] = useState<string | null>(null)
  // 完整编辑弹窗当前编辑的记录（null = 未打开）
  const [editDialogExpense, setEditDialogExpense] = useState<Expense | null>(null)
  const [hoverL1, setHoverL1] = useState<string | null>(null)
  const [customizingL1, setCustomizingL1] = useState<string | null>(null)
  const [customizingCategory, setCustomizingCategory] = useState(false)
  const [customName, setCustomName] = useState('')
  const [localRows, setLocalRows] = useState<LocalRow[]>([])
  const addBtnRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const nextTempId = useRef(-1)
  // refs 保持最新值，避免闭包陈旧问题
  const editingIdRef = useRef<number | null>(null)
  const editFormRef = useRef<EditForm>(editForm)
  const localRowsRef = useRef<LocalRow[]>([])

  editingIdRef.current = editingId
  editFormRef.current = editForm
  localRowsRef.current = localRows

  // 类型 code → 配置 查找表（含未定义的兜底）
  const txTypeByCode = new Map(txTypes.map((t) => [t.code, t]))

  // 某天是否锁定 = 月已锁 或 该天已锁；某天是否被整月锁覆盖（决定日期行锁按钮是否置灰）
  const isDateLocked = (date: string) => !!lockedMonths?.has(date.slice(0, 7)) || !!lockedDays?.has(date)
  const isMonthLockedFor = (date: string) => !!lockedMonths?.has(date.slice(0, 7))

  // 更新编辑表单并同步 ref（下拉选完同帧保存需读到最新值）
  const handleEditFormChange = (form: EditForm) => {
    setEditForm(form)
    editFormRef.current = form
  }

  const toggleCollapse = (key: string) => {
    setCollapsedMap((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const startEditing = (expense: Expense, field: EditField = 'category_l2') => {
    if (editingId === expense.id) {
      // 已在编辑中：只切换聚焦字段（切换下拉时同帧 showPicker 需要 onBlur 处理）
      setFocusField(field)
      return
    }
    setEditingId(expense.id)
    setFocusField(field)
    handleEditFormChange({
      category_l2: expense.category_l2,
      note: expense.note,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      type: expense.type || 'expense',
      is_non_daily: expense.is_non_daily,
    })
  }

  // 保存本地临时行 — 小类为空则丢弃，有值则真正入库
  const saveLocalRow = async (tempId: number) => {
    const rows = localRowsRef.current
    const row = rows.find((r) => r.tempId === tempId)
    if (!row) {
      setEditingId(null)
      setFocusField(null)
      return
    }

    const form = editFormRef.current

    // 小类没填 → 直接丢弃
    if (!form.category_l2) {
      setLocalRows((prev) => prev.filter((r) => r.tempId !== tempId))
      setEditingId(null)
      setFocusField(null)
      return
    }

    // 金额不能为负（支持算式，如 5*2 自动计算；0 金额也允许保存，保存后列表标红提示补填）
    const amountNum = evaluateExpression(form.amount)
    if (amountNum === null || amountNum < 0) {
      alert('请填写有效的金额（不能为负数）；如想放弃本条，请清空小类')
      return
    }

    // 有小类 → 真正保存到数据库
    try {
      await addExpense({
        amount: amountNum,
        category_l1: row.category_l1,
        category_l2: form.category_l2,
        date: row.date,
        note: form.note,
        payment_method: form.payment_method || '',
        type: form.type || 'expense',
        is_non_daily: form.is_non_daily,
      })
      setLocalRows((prev) => prev.filter((r) => r.tempId !== tempId))
      // 保存期间用户可能已切到别的行，避免误关
      if (editingIdRef.current === tempId) {
        setEditingId(null)
        setFocusField(null)
      }
      // 刷新父组件数据，让新记录显示出来
      onRefresh?.()
    } catch (err) {
      console.error('保存失败', err)
    }
  }

  // 保存数据库真实行 — 没变化直接退出，有变化先校验再保存
  const saveRealRow = async (id: number) => {
    const form = editFormRef.current
    const expense = expenses.find((ex) => ex.id === id)
    if (!expense) {
      setEditingId(null)
      setFocusField(null)
      return
    }
    // 没变化就直接退出编辑
    if (
      form.category_l2 === expense.category_l2 &&
      form.note === expense.note &&
      evaluateExpression(form.amount) === expense.amount &&
      (form.payment_method || '') === (expense.payment_method || '') &&
      (form.type || 'expense') === (expense.type || 'expense') &&
      form.is_non_daily === expense.is_non_daily
    ) {
      setEditingId(null)
      setFocusField(null)
      return
    }
    // 金额不能为负（支持算式，如 5*2 自动计算；0 金额也允许保存，保存后列表标红提示补填）
    const amountNum = evaluateExpression(form.amount)
    if (amountNum === null || amountNum < 0) {
      alert('请输入正确的金额（不能为负数）')
      return
    }
    try {
      await onUpdate(expense.id, form.category_l2, form.note, amountNum, form.payment_method || '', form.type || 'expense', form.is_non_daily)
      // 保存期间用户可能已切到别的行，避免误关
      if (editingIdRef.current === id) {
        setEditingId(null)
        setFocusField(null)
      }
    } catch (err) {
      console.error('保存失败', err)
    }
  }

  // 点击编辑行外部时自动保存
  useEffect(() => {
    if (editingId === null) return

    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        const id = editingIdRef.current
        if (id === null) return

        // 本地临时行 — 用 setTimeout 让 native select 的 change 事件先触发
        if (id < 0) {
          const localId = id
          setTimeout(() => saveLocalRow(localId), 0)
          return
        }

        // 数据库真实行
        saveRealRow(id)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, expenses, onUpdate])

  // 按回车保存
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const id = editingIdRef.current
      if (id === null) return

      if (id < 0) {
        saveLocalRow(id)
      } else {
        saveRealRow(id)
      }
    }
  }

  // 打开完整编辑弹窗：先退出任何行内编辑，避免弹窗打开后行内编辑的
  // 「点击外部自动保存」把旧值写回（弹窗会重新加载原始值）
  const openEditDialog = (expense: Expense) => {
    setEditingId(null)
    setFocusField(null)
    setEditDialogExpense(expense)
  }

  // 弹窗保存成功：展开目标日期分组，让改过日期的记录在列表里直接可见
  const handleDialogSave = async (id: number, input: ExpenseInput) => {
    await onUpdateFull(id, input)
    setExpandedDates((prev) => new Set(prev).add(input.date))
  }

  // 点击大类选择器外部关闭
  useEffect(() => {
    if (addingDate === null) return
    const handleClick = (e: MouseEvent) => {
      if (addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) {
        setAddingDate(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [addingDate])

  // 直接添加指定小类（联动面板右侧点击具体小类）— 只加这一条，带默认值预填
  const handleAddSubCategoryDirect = (date: string, l1: string, l2: string, resolvedSub?: { default_note: string; default_payment_method: string; default_amount: number; default_type: TransactionType; default_is_non_daily: boolean }) => {
    const cat = categories.find((c) => c.name === l1)
    // 自定义提交时分类表可能还没刷新到，用已解析的小类兜底
    const sub = resolvedSub ?? cat?.children.find((c) => c.name === l2)
    const id = nextTempId.current--
    const newRow: LocalRow = {
      tempId: id,
      date,
      category_l1: l1,
      category_l2: l2,
      note: sub?.default_note || '',
      amount: sub?.default_amount || 0,
      payment_method: sub?.default_payment_method || '',
      type: sub?.default_type || 'expense',
      is_non_daily: sub?.default_is_non_daily || false,
    }
    setLocalRows((prev) => [...prev, newRow])
    setEditingId(id)
    // 小类已选好，直接聚焦金额让用户输入
    setFocusField('amount')
    handleEditFormChange({
      category_l2: l2,
      note: sub?.default_note || '',
      amount: (sub?.default_amount || 0).toString(),
      payment_method: sub?.default_payment_method || '',
      type: sub?.default_type || 'expense',
      is_non_daily: sub?.default_is_non_daily || false,
    })
    // 展开该日期，让用户看到刚添加的记录
    setExpandedDates((prev) => new Set(prev).add(date))
    setAddingDate(null)
    setHoverL1(null)
  }

  // 自定义小类：自动保存为正式小类（重名/空名直接复用），再直接添加该小类一行
  const handleCustomSubmit = async (date: string, l1: string) => {
    const name = customName.trim()
    const cat = categories.find((c) => c.name === l1)
    if (!cat || !name) {
      setCustomizingL1(null)
      return
    }
    // 已存在同名小类 → 直接复用，不重复创建
    if (!cat.children.some((c) => c.name === name)) {
      try {
        await addSubCategory(cat.id, name)
      } catch (err) {
        console.error('添加自定义小类失败:', err)
      }
    }
    const resolvedSub = cat.children.find((c) => c.name === name) ?? {
      default_note: '',
      default_payment_method: '',
      default_amount: 0,
      default_type: 'expense' as TransactionType,
      default_is_non_daily: false,
    }
    setCustomName('')
    setCustomizingL1(null)
    // await 期间 addSubCategory 已触发分类刷新，React 会把分类更新与新增本地行合并到同一次渲染，
    // 直接添加即可（新小类会在同一帧进入下拉选项），无需 setTimeout 猜刷新时机。
    handleAddSubCategoryDirect(date, l1, name, resolvedSub)
  }

  // 点击左栏大类：有默认小类 → 批量添加所有默认小类行；没有 → 建一个空行让用户自选
  const handleAddCategory = (date: string, l1: string) => {
    const defaults = getDefaultSubs(l1)
    if (defaults.length > 0) {
      // 有默认小类 → 自动生成所有默认小类行
      const newRows: LocalRow[] = []
      for (const sub of defaults) {
        const id = nextTempId.current--
        newRows.push({
          tempId: id,
          date,
          category_l1: l1,
          category_l2: sub.name,
          note: sub.default_note || '',
          amount: sub.default_amount || 0,
          payment_method: sub.default_payment_method || '',
          type: sub.default_type || 'expense',
          is_non_daily: sub.default_is_non_daily,
        })
      }
      setLocalRows((prev) => [...prev, ...newRows])
      // 聚焦到最后一个小类行
      const lastSub = defaults[defaults.length - 1]
      const lastId = newRows[newRows.length - 1].tempId
      setEditingId(lastId)
      setFocusField('amount')
      handleEditFormChange({ category_l2: lastSub.name, note: lastSub.default_note || '', amount: (lastSub.default_amount || 0).toString(), payment_method: lastSub.default_payment_method || '', type: lastSub.default_type || 'expense', is_non_daily: lastSub.default_is_non_daily })
    } else {
      // 没有默认小类 → 和老逻辑一样创建空行让用户选择
      handleAddSubCategory(date, l1)
    }
    // 展开该日期，让用户看到刚添加的记录
    setExpandedDates((prev) => new Set(prev).add(date))
    setAddingDate(null)
    setHoverL1(null)
    setCustomizingL1(null)
  }

  // 自定义大类：自动保存为正式大类（重名直接复用），再悬停到它以便继续添加小类
  const handleCustomCategorySubmit = async () => {
    const name = customName.trim()
    if (!name) {
      setCustomizingCategory(false)
      return
    }
    // 已存在同名大类 → 直接复用，不重复创建
    if (!categories.some((c) => c.name === name)) {
      try {
        await addCategory(name, '📂')
      } catch (err) {
        console.error('添加自定义大类失败:', err)
      }
    }
    setCustomName('')
    setCustomizingCategory(false)
    setHoverL1(name)
    setCustomizingL1(null)
  }

  // 添加本地临时小类行
  const handleAddSubCategory = (date: string, l1: string) => {
    const id = nextTempId.current--
    const newRow: LocalRow = {
      tempId: id,
      date,
      category_l1: l1,
      category_l2: '',
      note: '',
      amount: 0,
      payment_method: '',
      type: defaultExpenseCode || 'expense',
      is_non_daily: false,
    }
    setLocalRows((prev) => [...prev, newRow])
    // 自动进入编辑
    setEditingId(id)
    setFocusField('category_l2')
    handleEditFormChange({ category_l2: '', note: '', amount: '0', payment_method: '', type: defaultExpenseCode || 'expense', is_non_daily: false })
  }

  if (expenses.length === 0 && localRows.length === 0 && (!extraDates || extraDates.length === 0) && (!missingDates || missingDates.length === 0)) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">{hasFilter ? '🔍' : '📝'}</div>
        <p className="text-slate-400 text-base">
          {hasFilter ? '当前筛选下没有记录' : '还没有消费记录'}
        </p>
        <p className="text-slate-300 text-sm mt-1">
          {hasFilter ? '清除筛选后即可看到全部记录' : '点击日期旁的 "+" 按钮记一笔吧'}
        </p>
      </div>
    )
  }

  // 按日期分组
  const groupedByDate: Record<string, Expense[]> = {}
  for (const e of expenses) {
    if (!groupedByDate[e.date]) groupedByDate[e.date] = []
    groupedByDate[e.date].push(e)
  }
  // 合并本地临时行
  for (const lr of localRows) {
    if (!groupedByDate[lr.date]) groupedByDate[lr.date] = []
    // 检查是否有同 tempId 的真实行(防止重复)
    const exists = groupedByDate[lr.date].some((e) => e.id === lr.tempId)
    if (!exists) {
      groupedByDate[lr.date].push({
        id: lr.tempId,
        amount: lr.amount,
        category_l1: lr.category_l1,
        category_l2: lr.category_l2,
        date: lr.date,
        note: lr.note,
        payment_method: lr.payment_method,
        type: lr.type,
        is_non_daily: lr.is_non_daily,
        created_at: '',
      })
    }
  }
  // 合并手动添加的空日期（无记录日期）
  for (const d of extraDates || []) {
    if (!groupedByDate[d]) groupedByDate[d] = []
  }

  // ===== 未记账快捷行 / 当天无消费行（两者都按连续段折叠）=====
  // 当前时间范围（近一周/近一月/本月/上月/历史月份/自定义）下缺失记录的日期：全部缺失日期都补快捷入口。
  // 已有日期集合 = 真实记录 + 本地临时行 + 手动添加的空白日期（groupedByDate 的所有键）
  const presentSet = new Set(Object.keys(groupedByDate))
  // 1) 未记账日期（未锁定、无记录）→ 「+ 添加」快捷行；缺失日期里排除已是空白日期的，避免重复
  const missingList = (missingDates || [])
    .filter((d) => !presentSet.has(d))
    .sort((a, b) => b.localeCompare(a)) // 倒序（列表日期整体倒序）
  // 2) 当天无消费（已锁定 + 无记录）→ 单行只读行，不再展开出大白块
  const noSpendList = (extraDates || [])
    .filter((d) => (groupedByDate[d]?.length ?? 0) === 0 && isDateLocked(d))
    .sort((a, b) => b.localeCompare(a))

  const quickDates = new Set<string>()
  // 折叠段：最早日期 → 该段「+ 更多（N 天）」信息；展开段：最早/最晚日期 → 该段「收起」信息
  const foldedRuns = new Map<string, { runId: string; count: number; noSpend: boolean }>()
  const expandedRunMins = new Map<string, { runId: string }>()
  const expandedRunMaxs = new Map<string, { runId: string }>()
  collectRunLayout(missingList, 'q', expandedRuns, {
    visible: quickDates, folded: foldedRuns, expandedMin: expandedRunMins, expandedMax: expandedRunMaxs,
  })
  // 无消费段同样折叠：被折进「+ 更多」里的日期要从渲染集合里剔除（extraDates 默认全部参与渲染）
  const noSpendVisible = new Set<string>()
  collectRunLayout(noSpendList, 'n', expandedRuns, {
    visible: noSpendVisible, folded: foldedRuns, expandedMin: expandedRunMins, expandedMax: expandedRunMaxs,
  }, true)
  for (const d of noSpendList) {
    if (!noSpendVisible.has(d)) delete groupedByDate[d]
  }
  // 只把要显示的快捷日期并入分组，参与倒序排序与渲染；其余（被折叠的中间日期）不渲染
  for (const d of quickDates) {
    if (!groupedByDate[d]) groupedByDate[d] = []
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedByDate)
        // 按日期倒序排列（本地临时行/手动添加的日期也要参与排序）
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, items]) => {
        const isQuickRow = quickDates.has(date)
        // 该日期是否锁定（月锁 或 日锁）；锁定后完全只读（锁住的空白天就是「当天无消费」）
        const locked = isDateLocked(date)
        const monthLocked = isMonthLockedFor(date)
        // 每日小计只统计「计入支出」的记录（与蓝色卡/右栏统计口径一致；收入、不计类型不参与）
        const dayTotal = items.reduce((sum, e) => sum + (txTypeByCode.get(e.type)?.category === 'expense' ? e.amount : 0), 0)

        // 在该日内按一级分类分组
        const groupedByL1: Record<string, Expense[]> = {}
        for (const e of items) {
          if (!groupedByL1[e.category_l1]) groupedByL1[e.category_l1] = []
          groupedByL1[e.category_l1].push(e)
        }

        const existingL1s = new Set(Object.keys(groupedByL1))
        // 当天无消费：已锁定 + 一条记录都没有 → 只渲染一行只读行，不再展开出大白块
        const noSpend = !isQuickRow && items.length === 0 && locked

        return (
          <div key={date}>
            {/* 「收起 / + 更多」按钮与行主体贴在一起（space-y-1.5）*/}
            <div className="space-y-1.5">
              {/* 展开段的最晚日期前：「收起」，点击折叠回「+ 更多（N 天）」（段首也放一个，展开后不用滚到底即可折回） */}
              {expandedRunMaxs.has(date) && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleRunCollapse(expandedRunMaxs.get(date)!.runId) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50 transition-colors text-sm"
                  title="折叠中间日期"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span>收起</span>
                </button>
              )}
              {/* 折叠段的最早日期前：该段折叠为「+ 更多（N 天）」，点击展开中间所有日期 */}
              {foldedRuns.has(date) && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleRunCollapse(foldedRuns.get(date)!.runId) }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition-colors text-sm"
                  title="展开中间所有日期"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>+ 更多（{foldedRuns.get(date)!.count} 天{foldedRuns.get(date)!.noSpend ? '无消费' : ''}）</span>
                </button>
              )}

              {/* 缺失日期：只显示快捷行（「+ 添加」），不显示日期标题 */}
              {isQuickRow && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddDate?.(date) }}
                    className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors text-sm"
                    title="添加此日期"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="truncate">添加 {formatDate(date)}</span>
                  </button>
                  {/* 锁按钮：未记录的日期没有日期标题行，在这里点一下 = 确认这天没消费（锁定后显示为「当天无消费」） */}
                  {onToggleDayLock && (
                    <HoverTip
                      className="shrink-0"
                      align="right"
                      text={monthLocked
                        ? '整月已锁定，请先解锁整月'
                        : locked ? '点击解锁' : '点击锁定（视为无消费）'}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!monthLocked) onToggleDayLock(date) }}
                        disabled={monthLocked}
                        aria-label={locked ? '解锁这一天' : '锁定这一天（视为无消费）'}
                        className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-dashed transition-colors ${
                          monthLocked
                            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                            : locked
                              ? 'border-amber-300 text-amber-500 hover:bg-amber-50'
                              : 'border-slate-300 text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                        }`}
                      >
                        {locked ? '🔒' : '🔓'}
                      </button>
                    </HoverTip>
                  )}
                </div>
              )}
              {/* 展开段的最早日期下：「收起」，点击折叠回「+ 更多（N 天）」 */}
              {expandedRunMins.has(date) && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleRunCollapse(expandedRunMins.get(date)!.runId) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50 transition-colors text-sm"
                  title="折叠中间日期"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  <span>收起</span>
                </button>
              )}
            </div>
            {/* 日期标题 + 每日小计 + 添加按钮 — 整行可点击展开/折叠（缺失日期不显示标题；当天无消费无内容可展开） */}
            {!isQuickRow && (
            <div
              onClick={noSpend ? undefined : () => toggleDateCollapse(date)}
              className={`flex items-center justify-between mb-2 px-0.5 ${noSpend ? '' : 'cursor-pointer'}`}
            >
              <div className={`flex items-center gap-2 ${noSpend ? '' : 'hover:opacity-75 transition-opacity'}`}>
                {!noSpend && (
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    expandedDates.has(date) ? '' : '-rotate-90'
                  }`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                )}
                <span className="text-base font-semibold text-slate-700">
                  {formatDate(date)}
                </span>
                <span className="text-sm text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {getWeekday(date)}
                </span>
                {/* 当天无消费：写在「周几」与右侧「合计」之间，一天只占这一行 */}
                {noSpend && <span className="text-sm text-slate-400">当天无消费</span>}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* 支付方式统计（桌面版） */}
                <PaymentMethodTotals items={items} paymentMethods={paymentMethods} txTypeByCode={txTypeByCode} className="hidden sm:flex" />
                {/* 支付方式统计（移动端） */}
                <PaymentMethodTotals items={items} paymentMethods={paymentMethods} txTypeByCode={txTypeByCode} className="sm:hidden" />

                <span className="inline-flex items-center gap-1 flex-shrink-0 text-sm">
                  {/* 「合计 + 金额」作为一个固定宽度整体，笔数独立固定宽度 */}
                  <span className="w-[112px] text-right text-slate-500">
                    <span>合计 </span>
                    <span className="font-medium text-slate-700 tabular-nums">¥{dayTotal.toFixed(2)}</span>
                  </span>
                  <span className="w-[44px] text-right text-slate-400 tabular-nums">{items.length}笔</span>
                </span>

                {/* 锁按钮：🔒 = 已锁定（点击解锁）/ 🔓 = 未锁定（点击锁定）。
                    整月锁生效时置灰不可点（要先解锁整月才能单独解锁当天） */}
                {onToggleDayLock && (
                  <HoverTip
                    className="shrink-0"
                    align="right"
                    text={monthLocked
                      ? '整月已锁定，请先解锁整月'
                      : locked
                        ? '点击解锁'
                        : items.length === 0
                          ? '点击锁定（视为无消费）'
                          : '点击锁定'}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); if (!monthLocked) onToggleDayLock(date) }}
                      disabled={monthLocked}
                      aria-label={locked ? '解锁这一天' : '锁定这一天'}
                      className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                        monthLocked
                          ? 'text-slate-300 cursor-not-allowed'
                          : locked
                            ? 'text-amber-500 hover:bg-amber-50'
                            : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                      }`}
                    >
                      {locked ? '🔒' : '🔓'}
                    </button>
                  </HoverTip>
                )}

                {/* 添加大类按钮（锁定日期完全只读，不提供入口） */}
                {!locked && (
                <>
                <div className="relative" ref={addingDate === date ? addBtnRef : undefined}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingDate(addingDate === date ? null : date); setHoverL1(null); setCustomizingL1(null); setCustomizingCategory(false); setCustomName('') }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                    title="添加消费大类"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  {/* 大类+小类联动选择弹出（已存在的大类灰色不可选；悬停大类右侧联动显示小类） */}
                  {addingDate === date && (
                    <CategoryAddPopover
                      categories={categories}
                      existingL1s={existingL1s}
                      hoverL1={hoverL1}
                      customizingL1={customizingL1}
                      customizingCategory={customizingCategory}
                      customName={customName}
                      onHoverL1={setHoverL1}
                      onCustomizingL1={setCustomizingL1}
                      onCustomizingCategory={setCustomizingCategory}
                      onCustomName={setCustomName}
                      onAddCategory={(l1) => handleAddCategory(date, l1)}
                      onAddSubDirect={(l1, l2) => handleAddSubCategoryDirect(date, l1, l2)}
                      onCustomCategorySubmit={handleCustomCategorySubmit}
                      onCustomSubmit={(l1) => handleCustomSubmit(date, l1)}
                    />
                  )}
                </div>

                {/* 删除当天按钮（锁定日期不提供） */}
                {onDeleteDate && items.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteDate(date) }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="删除当天所有记录"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                </>
                )}
              </div>
            </div>
            )}

            {/* 该日记录 — 按大类分组表格（搜索中强制展开，不改变用户手动折叠状态；
                「当天无消费」没有内容可展开，整日只有上面那一行） */}
            {!isQuickRow && !noSpend && (searchActive || expandedDates.has(date)) && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {Object.entries(groupedByL1).length === 0 ? (
                /* 走到这里必定是「未锁定的空白日期」（锁定的空白天在上层已判定为 noSpend、整日只有一行） */
                <div className="px-4 py-4 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setAddingDate(addingDate === date ? null : date)
                      setHoverL1(null)
                      setCustomizingL1(null)
                      setCustomizingCategory(false)
                      setCustomName('')
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg px-3 py-1.5 transition-colors"
                    title="添加消费大类"
                  >
                    <span className="text-base leading-none">➕</span>
                    <span>添加</span>
                  </button>
                </div>
              ) : (
              /* 按 categories 固定顺序排序 */
              Object.entries(groupedByL1)
                .sort(([a], [b]) => {
                  const idxA = categories.findIndex((c) => c.name === a)
                  const idxB = categories.findIndex((c) => c.name === b)
                  return idxA - idxB
                })
                .map(([l1, l1Items], l1Idx, l1Arr) => (
                  <ExpenseCategoryGroup
                    key={l1}
                    date={date}
                    l1={l1}
                    l1Items={l1Items}
                    isLastL1={l1Idx === l1Arr.length - 1}
                    collapsedMap={collapsedMap}
                    searchActive={searchActive}
                    readOnly={locked}
                    categories={categories}
                    paymentMethods={paymentMethods}
                    txTypeByCode={txTypeByCode}
                    onToggleCollapse={toggleCollapse}
                    onDeleteCategory={onDeleteCategory}
                    onAddSubCategory={handleAddSubCategory}
                    editingId={editingId}
                    editForm={editForm}
                    focusField={focusField}
                    editRef={editRef}
                    onEditFormChange={handleEditFormChange}
                    onStartEditing={startEditing}
                    onSaveRow={saveRealRow}
                    onKeyDown={handleKeyDown}
                    onDelete={onDelete}
                    onOpenEditDialog={openEditDialog}
                    onUpdate={onUpdate}
                    onRefresh={onRefresh}
                  />
                ))
              )}
            </div>
            )}
          </div>
        )
      })}

      {/* 完整编辑弹窗 */}
      {editDialogExpense && (
        <EditExpenseDialog
          expense={editDialogExpense}
          onSave={handleDialogSave}
          onClose={() => setEditDialogExpense(null)}
        />
      )}
    </div>
  )
}
