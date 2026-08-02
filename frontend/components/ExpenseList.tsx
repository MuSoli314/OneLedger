import { useState, useRef, useEffect } from 'react'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../data/categories'
import { addExpense } from '../data/database'
import { useCategories } from '../contexts/CategoryContext'
import type { Expense, TransactionType } from '../data/types'
import { format } from 'date-fns'

interface Props {
  expenses: Expense[]
  onDelete: (expense: Expense) => void
  onUpdate: (id: number, category_l2: string, note: string, amount: number, payment_method: string, type: TransactionType) => Promise<void>
  onRefresh?: () => void
  extraDates?: string[]
  onDeleteDate?: (date: string) => void
  onDeleteCategory?: (date: string, category_l1: string) => void
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
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MM/dd')
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

export default function ExpenseList({ expenses, onDelete, onUpdate, onRefresh, extraDates, onDeleteDate, onDeleteCategory }: Props) {
  const { categories } = useCategories()
  const [collapsedMap, setCollapsedMap] = useState<Set<string>>(new Set())
  // 日期折叠 — 默认全部折叠（空 Set = 没有展开的日期）
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

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

  const getCategoryIcon = (l1: string): string => {
    return categories.find((c) => c.name === l1)?.icon || '📂'
  }

  const getSubCategories = (l1: string): string[] => {
    return categories.find((c) => c.name === l1)?.children.map((c) => c.name) || []
  }

  const getDefaultSubs = (l1: string): { id: number; name: string; isDefault: boolean; defaultNote: string; defaultPaymentMethod: string; defaultAmount: number; defaultType: TransactionType }[] => {
    return categories.find((c) => c.name === l1)?.children.filter((c) => c.isDefault) || []
  }
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ category_l2: '', note: '', amount: '', payment_method: '', type: 'expense' as TransactionType })
  const [addingDate, setAddingDate] = useState<string | null>(null)
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

  const startEditing = (expense: Expense) => {
    if (editingId === expense.id) return
    setEditingId(expense.id)
    setEditForm({
      category_l2: expense.category_l2,
      note: expense.note,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      type: expense.type || 'expense',
    })
  }

  // 保存本地临时行 — 小类为空则丢弃，有值则真正入库
  const saveLocalRow = async (tempId: number) => {
    const rows = localRowsRef.current
    const row = rows.find((r) => r.tempId === tempId)
    if (!row) {
      setEditingId(null)
      return
    }

    const form = editFormRef.current

    // 小类没填 → 直接丢弃
    if (!form.category_l2) {
      setLocalRows((prev) => prev.filter((r) => r.tempId !== tempId))
      setEditingId(null)
      return
    }

    // 金额必须大于 0
    const amountNum = parseFloat(form.amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('请填写大于 0 的金额；如想放弃本条，请清空小类')
      return
    }

    // 有小类 → 真正保存到数据库
    try {
      await addExpense({
        amount: Math.round(amountNum * 100) / 100,
        category_l1: row.category_l1,
        category_l2: form.category_l2,
        date: row.date,
        note: form.note,
        payment_method: form.payment_method || '',
        type: row.type,
      })
      setLocalRows((prev) => prev.filter((r) => r.tempId !== tempId))
      setEditingId(null)
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
      return
    }
    // 没变化就直接退出编辑
    if (
      form.category_l2 === expense.category_l2 &&
      form.note === expense.note &&
      parseFloat(form.amount) === expense.amount &&
      (form.payment_method || '') === (expense.payment_method || '') &&
      (form.type || 'expense') === (expense.type || 'expense')
    ) {
      setEditingId(null)
      return
    }
    // 金额必须大于 0
    const amountNum = parseFloat(form.amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('请输入正确的金额（大于 0）')
      return
    }
    try {
      await onUpdate(expense.id, form.category_l2, form.note, Math.round(amountNum * 100) / 100, form.payment_method || '', form.type || 'expense')
      setEditingId(null)
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
        })
      }
      setLocalRows((prev) => [...prev, ...newRows])
      // 聚焦到最后一个小类行
      const lastSub = defaults[defaults.length - 1]
      const lastId = newRows[newRows.length - 1].tempId
      setEditingId(lastId)
      setEditForm({ category_l2: lastSub.name, note: lastSub.defaultNote || '', amount: (lastSub.defaultAmount || 0).toString(), payment_method: lastSub.defaultPaymentMethod || '', type: 'expense' })
    } else {
      // 没有默认小类 → 和老逻辑一样创建空行让用户选择
      handleAddSubCategory(date, l1)
    }
    // 展开该日期，让用户看到刚添加的记录
    setExpandedDates((prev) => new Set(prev).add(date))
    setAddingDate(null)
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
      type: 'expense',
    }
    setLocalRows((prev) => [...prev, newRow])
    // 自动进入编辑
    setEditingId(id)
    setEditForm({ category_l2: '', note: '', amount: '0', payment_method: '', type: 'expense' })
  }

  if (expenses.length === 0 && localRows.length === 0 && (!extraDates || extraDates.length === 0)) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📝</div>
        <p className="text-slate-400 text-base">还没有消费记录</p>
        <p className="text-slate-300 text-sm mt-1">点击日期旁的 "+" 按钮记一笔吧</p>
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
        created_at: '',
      })
    }
  }
  // 合并手动添加的空日期（无记录日期）
  for (const d of extraDates || []) {
    if (!groupedByDate[d]) groupedByDate[d] = []
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedByDate)
        // 按日期倒序排列（本地临时行/手动添加的日期也要参与排序）
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, items]) => {
        const dayTotal = items.reduce((sum, e) => sum + e.amount, 0)

        // 在该日内按一级分类分组
        const groupedByL1: Record<string, Expense[]> = {}
        for (const e of items) {
          if (!groupedByL1[e.category_l1]) groupedByL1[e.category_l1] = []
          groupedByL1[e.category_l1].push(e)
        }

        const existingL1s = new Set(Object.keys(groupedByL1))

        return (
          <div key={date}>
            {/* 日期标题 + 每日小计 + 添加按钮 — 整行可点击展开/折叠 */}
            <div
              onClick={() => toggleDateCollapse(date)}
              className="flex items-center justify-between mb-2 px-0.5 cursor-pointer hover:opacity-75 transition-opacity"
            >
              <div className="flex items-center gap-2">
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
                      if (pm) pmTotals[pm] = (pmTotals[pm] || 0) + e.amount
                    }
                    return Object.entries(pmTotals)
                      .filter(([, total]) => total > 0)
                      .map(([pm, total]) => {
                        const pmInfo = PAYMENT_METHODS.find((p) => p.name === pm)
                        return (
                          <span key={pm} className="inline-flex items-center gap-0.5 text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            <span>{pmInfo?.icon || ''}</span>
                            <span className="font-medium">{pm}</span>
                            <span className="tabular-nums">¥{total.toFixed(2)}</span>
                          </span>
                        )
                      })
                  })()}
                </div>

                {/* 添加大类按钮 */}
                <div className="relative" ref={addingDate === date ? addBtnRef : undefined}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddingDate(addingDate === date ? null : date) }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                    title="添加消费大类"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  {/* 大类选择弹出（已存在的大类灰色不可选） */}
                  {addingDate === date && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 max-h-60 overflow-y-auto">
                      {categories.map((cat) => {
                        const disabled = existingL1s.has(cat.name)
                        return (
                          <button
                            key={cat.name}
                            disabled={disabled}
                            onClick={() => !disabled && handleAddCategory(date, cat.name)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              disabled
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <span className={`text-lg ${disabled ? 'opacity-40' : ''}`}>{cat.icon}</span>
                            <span>{cat.name}</span>
                            {disabled && <span className="text-[10px] ml-auto text-slate-300">已有</span>}
                          </button>
                        )
                      })}
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

                {/* 支付方式统计（移动端） */}
                <div className="sm:hidden flex items-center gap-1 flex-wrap">
                  {(() => {
                    const pmTotals: Record<string, number> = {}
                    for (const e of items) {
                      const pm = e.payment_method || ''
                      if (pm) pmTotals[pm] = (pmTotals[pm] || 0) + e.amount
                    }
                    return Object.entries(pmTotals)
                      .filter(([, total]) => total > 0)
                      .map(([pm, total]) => {
                        const pmInfo = PAYMENT_METHODS.find((p) => p.name === pm)
                        return (
                          <span key={pm} className="inline-flex items-center gap-0.5 text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            <span>{pmInfo?.icon || ''}</span>
                            <span className="font-medium">{pm}</span>
                            <span className="tabular-nums">¥{total.toFixed(2)}</span>
                          </span>
                        )
                      })
                  })()}
                </div>

                <span className="text-sm text-slate-500">
                  小计 <span className="font-medium text-slate-700">¥{dayTotal.toFixed(2)}</span>
                  {!expandedDates.has(date) && items.length > 0 && (
                    <span className="text-slate-300 ml-1">({items.length}笔)</span>
                  )}
                </span>
              </div>
            </div>

            {/* 该日记录 — 按大类分组表格 */}
            {expandedDates.has(date) && (
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
                const l1Total = l1Items.reduce((s, e) => s + e.amount, 0)
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
                      className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer ${
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
                      return (
                        <div
                          key={expense.id}
                          ref={isEditing ? editRef : undefined}
                          className={`flex items-center gap-4 px-4 pl-20 py-3.5 text-base transition-colors ${
                            isEditing
                              ? 'bg-indigo-50/60 border-l-2 border-l-primary'
                              : 'hover:bg-slate-50/50 cursor-pointer group'
                          } ${isLastItem && !isLocal ? '' : 'border-b border-slate-50'}`}
                          onClick={() => !isEditing && startEditing(expense)}
                        >
                          {/* 小类 */}
                          {isEditing ? (
                            <div className="w-[110px] flex-shrink-0">
                              <select
                                value={editForm.category_l2}
                                onChange={(e) => {
                                  const newL2 = e.target.value
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
                                    })
                                  } else {
                                    // 已有记录：只改小类，保留原金额/备注/支付方式
                                    setEditForm({ ...editForm, category_l2: newL2 })
                                  }
                                }}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary text-slate-700"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="" disabled>请选择小类</option>
                                {getSubCategories(expense.category_l1).map((sc) => (
                                  <option key={sc} value={sc}>{sc}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="w-[110px] min-w-0 flex-shrink-0">
                              <span className={`font-medium ${expense.category_l2 ? 'text-slate-700' : 'text-slate-300 italic'}`}>
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
                                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
                                  style={{ color: editForm.type === 'income' ? '#10b981' : editForm.type === 'ignore' ? '#94a3b8' : '#ef4444' }}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={handleKeyDown}
                                  placeholder="金额"
                                />
                              </div>
                            ) : (
                              <span className={`text-base font-semibold tabular-nums w-[100px] text-right ${
                                expense.type === 'income' ? 'text-emerald-500' : expense.type === 'ignore' ? 'text-slate-400' : 'text-expense'
                              }`}>
                                {expense.type === 'income' ? '+' : expense.type === 'ignore' ? '' : '-'}¥{expense.amount.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* 支付方式 */}
                          {isEditing ? (
                            <div className="w-[90px] flex-shrink-0">
                              <select
                                value={editForm.payment_method}
                                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 bg-white focus:outline-none focus:border-primary text-slate-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">支付方式</option>
                                {PAYMENT_METHODS.map((pm) => (
                                  <option key={pm.name} value={pm.name}>{pm.icon} {pm.name}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            expense.payment_method ? (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                  {PAYMENT_METHODS.find((pm) => pm.name === expense.payment_method)?.icon || ''}
                                  {expense.payment_method}
                                </span>
                              </div>
                            ) : null
                          )}

                          {/* 收支类型 */}
                          {isEditing ? (
                            <div className="w-[80px] flex-shrink-0">
                              <select
                                value={editForm.type}
                                onChange={(e) => setEditForm({ ...editForm, type: e.target.value as TransactionType })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 bg-white focus:outline-none focus:border-primary text-slate-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {TRANSACTION_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>{t.icon} {t.name}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                expense.type === 'expense' ? 'text-red-500 bg-red-50'
                                  : expense.type === 'income' ? 'text-emerald-600 bg-emerald-50'
                                  : 'text-slate-500 bg-slate-100'
                              }`}>
                                {expense.type === 'expense' ? '💸 支出'
                                  : expense.type === 'income' ? '💰 收入'
                                  : '⏭️ 不计'}
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
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-primary text-slate-700"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleKeyDown}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-400 truncate block">
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
                        className={`w-full flex items-center gap-2 px-4 pl-20 py-2.5 text-sm text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-b border-slate-50 ${
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
