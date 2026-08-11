import { useState, useRef, useEffect } from 'react'
import InlineSelect from './InlineSelect'
import { useSettings } from '../contexts/SettingsContext'
import { addExpense } from '../data/database'
import { evaluateExpression } from '../data/calcUtils'
import { useCategories } from '../contexts/CategoryContext'
import type { Expense, TransactionType } from '../data/types'
import { format } from 'date-fns'

interface Props {
  expenses: Expense[]
  onDelete: (expense: Expense) => void
  onUpdate: (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType, isNonDaily: boolean) => Promise<void>
  onRefresh?: () => void
  extraDates?: string[]
  /** 整月视图下缺失记录的日期（本月/上月/历史月份）— 列表里为这些日期补「+ 添加」快捷行 */
  missingDates?: string[]
  /** 点击「+ 添加」快捷行时回调（新增该缺失日期，行为与「添加日期」弹窗一致） */
  onAddDate?: (date: string) => void
  onDeleteDate?: (date: string) => void
  onDeleteCategory?: (date: string, category_l1: string) => void
  // 是否正在筛选（支付方式/分类），仅影响空状态文案
  hasFilter?: boolean
}

interface LocalRow {
  tempId: number
  date: string
  category_l1: string
  category_l2: string
  note: string
  amount: number
  payment_method: string
  type: TransactionType
  isNonDaily: boolean
}

/** 行内编辑可聚焦的字段 */
type EditField = 'category_l2' | 'amount' | 'payment_method' | 'type' | 'note'

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy/MM/dd')
  } catch {
    return dateStr
  }
}

function getWeekday(dateStr: string): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  try {
    return weekdays[new Date(dateStr).getDay()]
  } catch {
    return ''
  }
}

export default function ExpenseList({ expenses, onDelete, onUpdate, onRefresh, extraDates, missingDates, onAddDate, onDeleteDate, onDeleteCategory, hasFilter }: Props) {
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

  const getCategoryIcon = (l1: string): string => {
    return categories.find((c) => c.name === l1)?.icon || '📂'
  }

  const getSubCategories = (l1: string): string[] => {
    return categories.find((c) => c.name === l1)?.children.map((c) => c.name) || []
  }

  const getDefaultSubs = (l1: string) => {
    return categories.find((c) => c.name === l1)?.children.filter((c) => c.isDefault) || []
  }

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ category_l2: '', note: '', amount: '', payment_method: '', type: 'expense' as TransactionType, isNonDaily: false })
  // 进入编辑时聚焦哪个字段（点哪个格子聚焦哪个）
  const [focusField, setFocusField] = useState<EditField | null>(null)
  // 编辑控件 refs，按 focusField 聚焦
  const categoryL2Ref = useRef<HTMLButtonElement | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const paymentRef = useRef<HTMLButtonElement | null>(null)
  const typeRef = useRef<HTMLButtonElement | null>(null)
  const noteRef = useRef<HTMLInputElement | null>(null)
  const [addingDate, setAddingDate] = useState<string | null>(null)
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
  const editFormRef = useRef(editForm)
  const localRowsRef = useRef<LocalRow[]>([])

  editingIdRef.current = editingId
  editFormRef.current = editForm
  localRowsRef.current = localRows

  // 类型 code → 配置 查找表（含未定义的兜底）
  const txTypeByCode = new Map(txTypes.map((t) => [t.code, t]))

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
    setEditForm({
      category_l2: expense.category_l2,
      note: expense.note,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      type: expense.type || 'expense',
      isNonDaily: expense.isNonDaily,
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
        isNonDaily: form.isNonDaily,
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
      form.isNonDaily === expense.isNonDaily
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
      await onUpdate(expense.id, form.category_l2, form.note, amountNum, form.payment_method || '', form.type || 'expense', form.isNonDaily)
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

  // 进入编辑态后，按 focusField 聚焦对应编辑控件
  useEffect(() => {
    if (editingId === null) return
    const refMap: Record<EditField, React.RefObject<HTMLInputElement | HTMLButtonElement | null>> = {
      category_l2: categoryL2Ref,
      amount: amountRef,
      payment_method: paymentRef,
      type: typeRef,
      note: noteRef,
    }
    const el = refMap[focusField || 'category_l2']?.current
    if (!el) return
    el.focus()
  }, [editingId, focusField])

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

  const handleDeleteClick = (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation()
    onDelete(expense)
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
  const handleAddSubCategoryDirect = (date: string, l1: string, l2: string, resolvedSub?: { defaultNote: string; defaultPaymentMethod: string; defaultAmount: number; defaultType: TransactionType; defaultIsNonDaily: boolean }) => {
    const cat = categories.find((c) => c.name === l1)
    // 自定义提交时分类表可能还没刷新到，用已解析的小类兜底
    const sub = resolvedSub ?? cat?.children.find((c) => c.name === l2)
    const id = nextTempId.current--
    const newRow: LocalRow = {
      tempId: id,
      date,
      category_l1: l1,
      category_l2: l2,
      note: sub?.defaultNote || '',
      amount: sub?.defaultAmount || 0,
      payment_method: sub?.defaultPaymentMethod || '',
      type: sub?.defaultType || 'expense',
      isNonDaily: sub?.defaultIsNonDaily || false,
    }
    setLocalRows((prev) => [...prev, newRow])
    setEditingId(id)
    // 小类已选好，直接聚焦金额让用户输入
    setFocusField('amount')
    setEditForm({
      category_l2: l2,
      note: sub?.defaultNote || '',
      amount: (sub?.defaultAmount || 0).toString(),
      payment_method: sub?.defaultPaymentMethod || '',
      type: sub?.defaultType || 'expense',
      isNonDaily: sub?.defaultIsNonDaily || false,
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
      defaultNote: '',
      defaultPaymentMethod: '',
      defaultAmount: 0,
      defaultType: 'expense' as TransactionType,
      defaultIsNonDaily: false,
    }
    setCustomName('')
    setCustomizingL1(null)
    // 等待分类刷新后自动带出默认值添加一行（新小类默认值用已解析的兜底）
    setTimeout(() => handleAddSubCategoryDirect(date, l1, name, resolvedSub), 0)
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
          note: sub.defaultNote || '',
          amount: sub.defaultAmount || 0,
          payment_method: sub.defaultPaymentMethod || '',
          type: sub.defaultType || 'expense',
          isNonDaily: sub.defaultIsNonDaily,
        })
      }
      setLocalRows((prev) => [...prev, ...newRows])
      // 聚焦到最后一个小类行
      const lastSub = defaults[defaults.length - 1]
      const lastId = newRows[newRows.length - 1].tempId
      setEditingId(lastId)
      setFocusField('amount')
      setEditForm({ category_l2: lastSub.name, note: lastSub.defaultNote || '', amount: (lastSub.defaultAmount || 0).toString(), payment_method: lastSub.defaultPaymentMethod || '', type: lastSub.defaultType || 'expense', isNonDaily: lastSub.defaultIsNonDaily })
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
      isNonDaily: false,
    }
    setLocalRows((prev) => [...prev, newRow])
    // 自动进入编辑
    setEditingId(id)
    setFocusField('category_l2')
    setEditForm({ category_l2: '', note: '', amount: '0', payment_method: '', type: defaultExpenseCode || 'expense', isNonDaily: false })
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
        isNonDaily: lr.isNonDaily,
        created_at: '',
      })
    }
  }
  // 合并手动添加的空日期（无记录日期）
  for (const d of extraDates || []) {
    if (!groupedByDate[d]) groupedByDate[d] = []
  }

  // ===== 缺失日期快捷行 =====
  // 整月视图（本月/上月/历史月份）下缺失记录的日期：全部缺失日期都补快捷入口。
  // 按连续（差 1 天）分段：段长 ≤3 天全部显示；段长 >3 天只显示两端，中间折叠成「+ 更多（N 天）」。
  // 已有日期集合 = 真实记录 + 本地临时行 + 手动添加的空白日期（groupedByDate 的所有键）
  const presentSet = new Set(Object.keys(groupedByDate))
  // 缺失日期里，排除已是空白日期（extraDates 已单独渲染成日期分组）的，避免重复
  const missingList = (missingDates || [])
    .filter((d) => !presentSet.has(d))
    .sort((a, b) => b.localeCompare(a)) // 倒序（列表日期整体倒序）
  // 把缺失日期切成连续段：runs[i] = 该段按时间升序排列的日期数组
  const runs: string[][] = []
  for (const d of missingList) {
    if (runs.length === 0) {
      runs.push([d])
    } else {
      const last = runs[runs.length - 1]
      const gap = Math.abs(new Date(`${last[last.length - 1]}T00:00:00`).getTime() - new Date(`${d}T00:00:00`).getTime())
      if (gap === 86400000) {
        // d 与当前段尾部正好差 1 天，继续当前段
        last.push(d)
      } else {
        runs.push([d])
      }
    }
  }
  // 段内升序 → 每段内部按时间升序排列；但段本身按「段的起点日期」降序排列（与列表倒序一致）
  runs.forEach((r) => r.sort((a, b) => a.localeCompare(b)))
  runs.sort((a, b) => b[b.length - 1].localeCompare(a[a.length - 1]))
  // 每段折叠时只显示两端（max = 段内最大日期、min = 段内最小日期）；展开时显示全部
  // runId 用于标识段的展开状态
  const runEnds: { id: string, min: string, max: string, dates: string[], expanded: boolean }[] = []
  for (const r of runs) {
    if (r.length <= 3) {
      // 段长 ≤ 3：全部显示（无需折叠）
      runEnds.push({ id: r[0], min: r[0], max: r[r.length - 1], dates: r, expanded: true })
    } else {
      // 段长 > 3：只显示两端，中间折叠成「+ 更多」
      const runId = `${r[0]}~${r[r.length - 1]}`
      runEnds.push({ id: runId, min: r[0], max: r[r.length - 1], dates: r, expanded: expandedRuns.has(runId) })
    }
  }
  const quickDates = new Set<string>()
  // 折叠段：min 日期 → 该段「+ 更多（N 天）」信息；展开段：min 日期 → 该段「收起」信息
  const foldedRuns = new Map<string, { runId: string; count: number }>()
  const expandedRunMins = new Map<string, { runId: string }>()
  for (const r of runEnds) {
    if (r.expanded) {
      for (const d of r.dates) quickDates.add(d)
      if (r.dates.length > 3) expandedRunMins.set(r.min, { runId: r.id })
    } else {
      quickDates.add(r.min)
      quickDates.add(r.max)
      if (r.dates.length > 3) foldedRuns.set(r.min, { runId: r.id, count: r.dates.length - 2 })
    }
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
        const dayTotal = items.reduce((sum, e) => sum + (txTypeByCode.get(e.type)?.category === 'ignore' ? 0 : e.amount), 0)

        // 在该日内按一级分类分组
        const groupedByL1: Record<string, Expense[]> = {}
        for (const e of items) {
          if (!groupedByL1[e.category_l1]) groupedByL1[e.category_l1] = []
          groupedByL1[e.category_l1].push(e)
        }

        const existingL1s = new Set(Object.keys(groupedByL1))

        return (
          <div key={date}>
            {/* 缺失日期：只显示快捷行（「+ 添加」；折叠段还配「+ 更多（N 天）」/「收起」），不显示日期标题 */}
            {isQuickRow && (
              <div className="space-y-1.5">
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
                    <span>+ 更多（{foldedRuns.get(date)!.count} 天）</span>
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAddDate?.(date) }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors text-sm"
                  title="添加此日期"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>添加 {formatDate(date)}</span>
                </button>
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
            )}
            {/* 日期标题 + 每日小计 + 添加按钮 — 整行可点击展开/折叠（缺失日期不显示标题） */}
            {!isQuickRow && (
            <div
              onClick={() => toggleDateCollapse(date)}
              className="flex items-center justify-between mb-2 px-0.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    expandedDates.has(date) ? '' : '-rotate-90'
                  }`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-base font-semibold text-slate-700">
                  {formatDate(date)}
                </span>
                <span className="text-sm text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {getWeekday(date)}
                </span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* 支付方式统计（只显示金额 > 0 的） */}
                <div className="hidden sm:flex items-center gap-1 flex-wrap">
                  {(() => {
                    const pmTotals: Record<string, number> = {}
                    for (const e of items) {
                      const pm = e.payment_method || ''
                      if (pm && e.type !== 'ignore') pmTotals[pm] = (pmTotals[pm] || 0) + e.amount
                    }
                    return Object.entries(pmTotals)
                      .filter(([, total]) => total > 0)
                      .map(([pm, total]) => {
                        const pmInfo = paymentMethods.find((p) => p.name === pm)
                        return (
                          <span key={pm} className="relative group inline-flex items-center gap-0.5 text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md cursor-pointer">
                            <span>{pmInfo?.icon || ''}</span>
                            <span className="tabular-nums font-medium">¥{total.toFixed(2)}</span>
                            {/* 悬浮气泡（CSS 自绘，WebView 也支持） */}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                              {pm}
                            </span>
                          </span>
                        )
                      })
                  })()}
                </div>

                {/* 支付方式统计（移动端） */}
                <div className="sm:hidden flex items-center gap-1 flex-wrap">
                  {(() => {
                    const pmTotals: Record<string, number> = {}
                    for (const e of items) {
                      const pm = e.payment_method || ''
                      if (pm && e.type !== 'ignore') pmTotals[pm] = (pmTotals[pm] || 0) + e.amount
                    }
                    return Object.entries(pmTotals)
                      .filter(([, total]) => total > 0)
                      .map(([pm, total]) => {
                        const pmInfo = paymentMethods.find((p) => p.name === pm)
                        return (
                          <span key={pm} className="relative group inline-flex items-center gap-0.5 text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md cursor-pointer">
                            <span>{pmInfo?.icon || ''}</span>
                            <span className="tabular-nums font-medium">¥{total.toFixed(2)}</span>
                            {/* 悬浮气泡（CSS 自绘，WebView 也支持） */}
                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                              {pm}
                            </span>
                          </span>
                        )
                      })
                  })()}
                </div>

                <span className="text-sm text-slate-500">
                  合计 <span className="font-medium text-slate-700">¥{dayTotal.toFixed(2)}</span>
                  {!expandedDates.has(date) && items.length > 0 && (
                    <span className="text-slate-300 ml-1">({items.length}笔)</span>
                  )}
                </span>

                {/* 添加大类按钮 */}
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
                    <div className="absolute right-0 top-full mt-1 z-30 flex bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                      {/* 左列：大类列表 */}
                      <div className="w-40 max-h-72 overflow-y-auto py-1">
                        {customizingCategory ? (
                          <input
                            autoFocus
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCustomCategorySubmit()
                              if (e.key === 'Escape') { setCustomizingCategory(false); setCustomName('') }
                            }}
                            onBlur={() => { setCustomizingCategory(false); setCustomName('') }}
                            placeholder="输入大类名，回车确认"
                            className="w-full h-7 my-0.5 px-2 border border-primary rounded-lg text-sm bg-white focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setCustomizingCategory(true); setCustomName('') }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>自定义</span>
                          </button>
                        )}
                        {categories.map((cat) => {
                          const disabled = existingL1s.has(cat.name)
                          return (
                            <button
                              key={cat.name}
                              disabled={disabled}
                              onMouseEnter={() => !disabled && setHoverL1(cat.name)}
                              onClick={() => !disabled && handleAddCategory(date, cat.name)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                                disabled
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : hoverL1 === cat.name
                                  ? 'bg-primary/5 text-primary'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`text-lg ${disabled ? 'opacity-40' : ''}`}>{cat.icon}</span>
                              <span>{cat.name}</span>
                              {disabled && <span className="text-[10px] ml-auto text-slate-300">已有</span>}
                            </button>
                          )
                        })}
                      </div>
                      {/* 右列：当前悬停大类的小类 */}
                      <div className="w-40 max-h-72 overflow-y-auto py-1 border-l border-slate-100 bg-slate-50/50">
                        {customizingCategory ? (
                          <div className="px-3 py-1.5 text-sm text-slate-400">确认大类后继续选择小类</div>
                        ) : hoverL1 ? (
                          customizingL1 === hoverL1 ? (
                            <input
                              autoFocus
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCustomSubmit(date, hoverL1)
                                if (e.key === 'Escape') { setCustomizingL1(null); setCustomName('') }
                              }}
                              onBlur={() => { setCustomizingL1(null); setCustomName('') }}
                              placeholder="输入小类名，回车确认"
                              className="w-full h-7 my-0.5 px-2 border border-primary rounded-lg text-sm bg-white focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => { setCustomizingL1(hoverL1); setCustomName('') }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span>自定义</span>
                            </button>
                          )
                        ) : null}
                        {hoverL1 && (
                          getSubCategories(hoverL1).length > 0 ? (
                            getSubCategories(hoverL1).map((sc) => (
                              <button
                                key={sc}
                                onClick={() => handleAddSubCategoryDirect(date, hoverL1, sc)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                                <span>{sc}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-1.5 text-sm text-slate-400">暂无小类</div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 删除当天按钮 */}
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
              </div>
            </div>
            )}

            {/* 该日记录 — 按大类分组表格 */}
            {!isQuickRow && expandedDates.has(date) && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {Object.entries(groupedByL1).length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-300 text-xs">
                  点击日期旁的 <span className="inline-flex items-center gap-0.5 text-primary">➕</span> 添加消费分类
                </div>
              ) : (
              /* 按 categories 固定顺序排序 */
              Object.entries(groupedByL1)
                .sort(([a], [b]) => {
                  const idxA = categories.findIndex((c) => c.name === a)
                  const idxB = categories.findIndex((c) => c.name === b)
                  return idxA - idxB
                })
                .map(([l1, l1Items], l1Idx, l1Arr) => {
                const l1Total = l1Items.reduce((s, e) => s + (txTypeByCode.get(e.type)?.category === 'ignore' ? 0 : e.amount), 0)
                // 按分类管理器中的小类顺序显示
                const cat = categories.find((c) => c.name === l1)
                const subOrder = new Map(cat?.children.map((c, i) => [c.name, i]) || [])
                const sortedL1Items = [...l1Items].sort((a, b) => {
                  const ai = subOrder.get(a.category_l2) ?? 999
                  const bi = subOrder.get(b.category_l2) ?? 999
                  return ai - bi
                })
                const isLastL1 = l1Idx === l1Arr.length - 1
                const collapseKey = `${date}|${l1}`
                const collapsed = collapsedMap.has(collapseKey)
                return (
                  <div key={l1}>
                    {/* 大类标题行（可点击折叠） */}
                    <button
                      onClick={() => toggleCollapse(collapseKey)}
                      className={`w-full flex items-center justify-between px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer ${
                        isLastL1 && collapsed ? '' : 'border-b border-slate-50'
                      } ${collapsed ? 'rounded-b-xl' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                            collapsed ? '-rotate-90' : ''
                          }`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-lg">{getCategoryIcon(l1)}</span>
                        <span className="text-base font-semibold text-slate-700">{l1}</span>
                        <span className="text-sm text-slate-400 ml-1">
                          {l1Items.length}笔
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-500 tabular-nums">
                        合计 ¥{l1Total.toFixed(2)}
                      </span>
                      {onDeleteCategory && l1Items.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteCategory(date, l1) }}
                          className="ml-1.5 w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
                          title="删除本大类所有记录"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </button>

                    {/* 该大类的每一条记录（折叠时隐藏） */}
                    {!collapsed && sortedL1Items.map((expense, itemIdx) => {
                      const isLastItem = itemIdx === sortedL1Items.length - 1 && isLastL1
                      const isEditing = editingId === expense.id
                      const isLocal = expense.id < 0
                      const rowTx = txTypeByCode.get(expense.type)
                      // 金额为 0 的记录标红提醒（非 ignore 类型；编辑态仍走 indigo 编辑样式）
                      const isZeroAmount = expense.amount === 0 && rowTx?.category !== 'ignore'
                      return (
                        <div
                          key={expense.id}
                          ref={isEditing ? editRef : undefined}
                          className={`flex items-center gap-2 px-2 pl-2 py-1 text-base transition-colors ${
                            isEditing
                              ? 'bg-indigo-50 border-l-2 border-l-primary'
                              : isZeroAmount
                              ? 'bg-red-100 hover:bg-red-200 border-l-2 border-l-red-500 cursor-pointer group'
                              : rowTx?.category === 'ignore'
                              ? 'bg-slate-300 hover:bg-slate-400 cursor-pointer group'
                              : expense.isNonDaily
                              ? 'bg-slate-100/60 hover:bg-slate-100 cursor-pointer group'
                              : 'hover:bg-slate-50 cursor-pointer group'
                          } ${isLastItem && !isLocal ? '' : 'border-b border-slate-50'}`}
                          onClick={() => !isEditing && startEditing(expense)}
                        >
                          {/* 日常/非日常徽章 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isLocal || isEditing) {
                                // 新增本地行或已在编辑态：只改本地表单（新增行由行外点击/回车统一入库；编辑行由行外点击/回车统一保存）
                                const f = { ...editForm, isNonDaily: !editForm.isNonDaily }
                                setEditForm(f)
                                editFormRef.current = f
                                return
                              }
                              // 非编辑态真实行：立即切换保存（不改其它字段）
                              const next = !expense.isNonDaily
                              onUpdate(expense.id, expense.category_l2, expense.note, expense.amount, expense.payment_method || '', expense.type || 'expense', next)
                                .then(() => onRefresh?.())
                                .catch((err) => console.error('保存失败', err))
                            }}
                            className={`w-[52px] h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] transition-colors ${
                              ((isEditing || isLocal) ? editForm.isNonDaily : expense.isNonDaily)
                                ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                : 'bg-transparent text-slate-300 border border-dashed border-slate-200 hover:border-slate-400 hover:text-slate-500'
                            }`}
                            title={isEditing || isLocal ? '切换非日常标记' : (expense.isNonDaily ? '非日常（点击改为日常）' : '日常（点击改为非日常）')}
                          >
                            {((isEditing || isLocal) ? editForm.isNonDaily : expense.isNonDaily) ? '非日常' : '日常'}
                          </button>
                          {/* 小类 */}
                          {isEditing ? (
                            <div className="w-[110px] flex-shrink-0">
                              <InlineSelect
                                value={editForm.category_l2}
                                options={getSubCategories(expense.category_l1).map((sc) => ({ value: sc, label: sc }))}
                                placeholder="请选择小类"
                                initialOpen={focusField === 'category_l2'}
                                textColor={editForm.category_l2 ? 'text-slate-700' : 'text-slate-400'}
                                ref={categoryL2Ref}
                                className="w-full"
                                onChange={(newL2) => {
                                  if (isLocal) {
                                    // 新增行：选择小类时自动加载模板默认值
                                    const cat = categories.find((c) => c.name === expense.category_l1)
                                    const sub = cat?.children.find((c) => c.name === newL2)
                                    setEditForm({
                                      category_l2: newL2,
                                      note: sub?.defaultNote || '',
                                      payment_method: sub?.defaultPaymentMethod || '',
                                      amount: sub?.defaultAmount ? sub.defaultAmount.toString() : '0',
                                      type: sub?.defaultType || 'expense',
                                      isNonDaily: sub?.defaultIsNonDaily || false,
                                    })
                                  } else {
                                    // 已有记录：只改小类，保留原金额/备注/支付方式，选完即自动保存退出编辑
                                    const newForm = { ...editForm, category_l2: newL2 }
                                    setEditForm(newForm)
                                    editFormRef.current = newForm
                                    saveRealRow(expense.id)
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="w-[110px] min-w-0 flex-shrink-0 text-right"
                              onClick={(e) => { e.stopPropagation(); startEditing(expense, 'category_l2') }}
                            >
                              <span className={`text-sm font-medium ${expense.category_l2 ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                                {expense.category_l2 || '未设置'}
                              </span>
                            </div>
                          )}

                          {/* 金额 */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isEditing ? (
                              <div className="w-[90px]">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editForm.amount}
                                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                  className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
                                  style={{ color: txTypeByCode.get(editForm.type)?.category === 'income' ? '#10b981' : txTypeByCode.get(editForm.type)?.category === 'ignore' ? '#94a3b8' : '#ef4444' }}
                                  ref={amountRef}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={handleKeyDown}
                                  placeholder="金额"
                                />
                              </div>
                            ) : (
                              <span
                                className={`text-sm font-semibold tabular-nums w-[100px] text-right ${
                                  rowTx?.category === 'income' ? 'text-emerald-500' : rowTx?.category === 'ignore' ? 'text-slate-400' : 'text-expense'
                                }`}
                                onClick={(e) => { e.stopPropagation(); startEditing(expense, 'amount') }}
                              >
                                {rowTx?.category === 'income' ? '+' : rowTx?.category === 'ignore' ? '' : '-'}¥{expense.amount.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* 支付方式 */}
                          {isEditing ? (
                            <div className="w-[90px] flex-shrink-0">
                              <InlineSelect
                                value={editForm.payment_method}
                                options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
                                placeholder="支付方式"
                                initialOpen={focusField === 'payment_method'}
                                textColor="text-slate-500"
                                ref={paymentRef}
                                className="w-full"
                                onChange={(v) => {
                                  const newForm = { ...editForm, payment_method: v }
                                  setEditForm(newForm)
                                  // 已有记录：选完即自动保存退出编辑；新增行仅更新表单
                                  if (!isLocal) {
                                    editFormRef.current = newForm
                                    saveRealRow(expense.id)
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            expense.payment_method ? (
                              <div
                                className="w-[90px] flex-shrink-0 flex justify-end"
                                onClick={(e) => { e.stopPropagation(); startEditing(expense, 'payment_method') }}
                              >
                                <span className="inline-flex items-center gap-1 text-sm text-slate-400 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap">
                                  {paymentMethods.find((pm) => pm.name === expense.payment_method)?.icon || ''}
                                  {expense.payment_method}
                                </span>
                              </div>
                            ) : (
                              <div
                                className="w-[90px] flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); startEditing(expense, 'payment_method') }}
                              />
                            )
                          )}

                          {/* 收支类型 */}
                          {isEditing ? (
                            <div className="w-[80px] flex-shrink-0">
                              <InlineSelect
                                value={editForm.type}
                                options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
                                initialOpen={focusField === 'type'}
                                textColor="text-slate-600"
                                ref={typeRef}
                                className="w-full"
                                onChange={(v) => {
                                  const newForm = { ...editForm, type: v as TransactionType }
                                  setEditForm(newForm)
                                  // 已有记录：选完即自动保存退出编辑；新增行仅更新表单
                                  if (!isLocal) {
                                    editFormRef.current = newForm
                                    saveRealRow(expense.id)
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="w-[80px] flex-shrink-0 flex justify-end"
                              onClick={(e) => { e.stopPropagation(); startEditing(expense, 'type') }}
                            >
                              <span className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full whitespace-nowrap ${
                                !rowTx ? 'text-slate-500 bg-slate-200'
                                  : rowTx.category === 'expense' ? 'text-red-500 bg-red-50'
                                  : rowTx.category === 'income' ? 'text-emerald-600 bg-emerald-50'
                                  : 'text-slate-500 bg-slate-200'
                              }`}>
                                {rowTx ? `${rowTx.icon} ${rowTx.name}` : '🚫 未定义'}
                              </span>
                            </div>
                          )}

                          {/* 备注 */}
                          {isEditing ? (
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={editForm.note}
                                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                placeholder="备注（可选）"
                                className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white focus:outline-none focus:border-primary text-slate-700"
                                ref={noteRef}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                              />
                            </div>
                          ) : (
                            <div
                              className="flex-1 min-w-0"
                              onClick={(e) => { e.stopPropagation(); startEditing(expense, 'note') }}
                            >
                              <span className="text-sm text-slate-400 truncate block">
                                {expense.note || '-'}
                              </span>
                            </div>
                          )}

                          {/* 删除按钮 */}
                          <button
                            onClick={(e) => handleDeleteClick(e, expense)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
                              isEditing
                                ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
                            }`}
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}

                    {/* 添加小类按钮（折叠时也隐藏） */}
                    {!collapsed && (
                      <button
                        onClick={() => handleAddSubCategory(date, l1)}
                        className={`w-full flex items-center gap-2 px-4 pl-16 py-2.5 text-sm text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-b border-slate-50 ${
                          isLastL1 ? '' : ''
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>添加小类</span>
                      </button>
                    )}
                  </div>
                )
              }))}
            </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
