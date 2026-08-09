import { useState, useRef, useEffect, useCallback } from 'react'
import { useCategories } from '../contexts/CategoryContext'
import { useSettings } from '../contexts/SettingsContext'
import type { TransactionType } from '../data/types'
import { evaluateExpression } from '../data/calcUtils'
import { EMOJI_LIST } from '../data/emojis'
import { IconPickerButton, EmojiPickerGrid } from '../components/EmojiPicker'
import InlineSelect from '../components/InlineSelect'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** 小类行内编辑可聚焦的字段 */
type EditField = 'subName' | 'defaultAmount' | 'defaultPaymentMethod' | 'defaultType' | 'defaultNote'

/** 拖拽手柄图标（六点 grip） */
function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-6 h-7 flex items-center justify-center rounded text-slate-300 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
      title="拖拽排序"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    </button>
  )
}

/** 可拖拽的大类行 */
function SortableCategoryRow({
  id,
  cat,
  isExpanded,
  editingCatId,
  editingCatName,
  iconPickerCatId,
  pendingAddCatId,
  onToggleExpanded,
  onStartEditName,
  onChangeEditName,
  onSaveName,
  onIconPicker,
  onEmojiSelect,
  onCloseIconPicker,
  onDelete,
  onAddSub,
  children,
}: {
  id: string
  cat: { id: number; name: string; icon: string; children: { isDefault: boolean }[] }
  isExpanded: boolean
  editingCatId: number | null
  editingCatName: string
  iconPickerCatId: number | null
  pendingAddCatId: number | null
  onToggleExpanded: () => void
  onStartEditName: () => void
  onChangeEditName: (v: string) => void
  onSaveName: () => void
  onIconPicker: () => void
  onEmojiSelect: (emoji: string) => void
  onCloseIconPicker: () => void
  onDelete: () => void
  onAddSub: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  }

  const defaultCount = cat.children.filter((c) => c.isDefault).length

  const iconBtnRef = useRef<HTMLButtonElement>(null)
  const iconPanelRef = useRef<HTMLDivElement>(null)

  // 点击图标选择区外部自动关闭
  useEffect(() => {
    if (iconPickerCatId !== cat.id) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (iconPanelRef.current && !iconPanelRef.current.contains(t)
        && iconBtnRef.current && !iconBtnRef.current.contains(t)) {
        onCloseIconPicker()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [iconPickerCatId, cat.id, onCloseIconPicker])

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* 大类标题行 */}
      <div className="flex items-center gap-1 px-4 py-3 pl-2">
        {/* 拖拽手柄 */}
        <DragHandle {...attributes} {...listeners} />

        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <svg
            className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-lg flex-shrink-0">{cat.icon}</span>
          <span className="text-base font-semibold text-slate-700 truncate">
            {cat.name}
          </span>
          <span className="text-[11px] text-slate-400 flex-shrink-0">
            {cat.children.length}个
            {defaultCount > 0 && (
              <span className="text-primary ml-1">· {defaultCount}个默认</span>
            )}
          </span>
        </button>

        {/* 操作按钮 */}
        <button
          onClick={onStartEditName}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
          title="修改名称"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onIconPicker}
          ref={iconBtnRef}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
          title="修改图标"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
          title="删除分类"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 编辑名称输入框 */}
      {editingCatId === cat.id && (
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={editingCatName}
              onChange={(e) => onChangeEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); if (e.key === 'Escape') onChangeEditName('') }}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              onClick={onSaveName}
              className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              保存
            </button>
            <button
              onClick={onChangeEditName.bind(null, '')}
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 小类列表 */}
      {isExpanded && (
        <div className="border-t border-slate-50">
          {children}

          {/* 添加小类按钮 */}
          <button
            onClick={onAddSub}
            disabled={pendingAddCatId === cat.id}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-t border-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>添加小类</span>
          </button>
        </div>
      )}

      {/* 图标选择器弹出 */}
      {iconPickerCatId === cat.id && (
        <div ref={iconPanelRef} className="px-4 pb-3 border-t border-slate-50 pt-2">
          <div className="text-[11px] text-slate-400 mb-1.5">选择图标：</div>
          <EmojiPickerGrid current={cat.icon} onPick={onEmojiSelect} />
        </div>
      )}
    </div>
  )
}

/** 可拖拽的小类行 */
function SortableSubCategoryRow({
  id,
  sub,
  isEditing,
  editingSubId,
  subEditForm,
  subEditRef,
  focusField,
  onToggleDefault,
  onStartEdit,
  onSubEditFormChange,
  onSubEditKeyDown,
  onAutoSave,
  onDelete,
}: {
  id: string
  sub: { id: number; name: string; isDefault: boolean; defaultNote: string; defaultPaymentMethod: string; defaultAmount: number; defaultType: TransactionType }
  isEditing: boolean
  editingSubId: number | null
  subEditForm: { subName: string; defaultNote: string; defaultPaymentMethod: string; defaultAmount: string; defaultType: TransactionType }
  subEditRef: React.RefObject<HTMLDivElement | null>
  focusField: EditField | null
  onToggleDefault: () => void
  onStartEdit: (field?: EditField) => void
  onSubEditFormChange: (form: { subName: string; defaultNote: string; defaultPaymentMethod: string; defaultAmount: string; defaultType: TransactionType }) => void
  onSubEditKeyDown: (e: React.KeyboardEvent) => void
  /** 下拉选择后自动保存（选完即存并退出编辑） */
  onAutoSave: (form: { subName: string; defaultNote: string; defaultPaymentMethod: string; defaultAmount: string; defaultType: TransactionType }) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { paymentMethods, txTypes } = useSettings()

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  }

  // 编辑控件 refs，按 focusField 聚焦
  const subNameRef = useRef<HTMLInputElement | null>(null)
  const subAmountRef = useRef<HTMLInputElement | null>(null)
  const subPayRef = useRef<HTMLButtonElement | null>(null)
  const subTypeRef = useRef<HTMLButtonElement | null>(null)
  const subNoteRef = useRef<HTMLInputElement | null>(null)

  // 进入编辑态后按 focusField 聚焦对应编辑控件
  useEffect(() => {
    if (!isEditing) return
    const refMap: Record<EditField, React.RefObject<HTMLInputElement | HTMLButtonElement | null>> = {
      subName: subNameRef,
      defaultAmount: subAmountRef,
      defaultPaymentMethod: subPayRef,
      defaultType: subTypeRef,
      defaultNote: subNoteRef,
    }
    const el = refMap[focusField || 'subName']?.current
    if (!el) return
    el.focus()
    // oxlint 误报 focusField 非响应式，实际是父组件传入的 props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, focusField])

  return (
    <div
      ref={isEditing && editingSubId !== -1 ? subEditRef : setNodeRef}
      style={isEditing && editingSubId !== -1 ? undefined : style}
      onClick={() => onStartEdit()}
      className={`flex items-center gap-2 px-2 pl-2 py-1 text-base transition-colors border-b border-slate-50 ${
        isEditing
          ? 'bg-indigo-50 border-l-2 border-l-primary'
          : sub.defaultType === 'ignore'
          ? 'bg-slate-300 hover:bg-slate-400 cursor-pointer group'
          : 'hover:bg-slate-50 cursor-pointer group'
      }`}
    >
      {/* 拖拽手柄 */}
      {isEditing ? (
        <div className="w-6 flex-shrink-0" />
      ) : (
        <DragHandle
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* 默认开关 */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDefault() }}
        className={`w-4 h-4 flex items-center justify-center rounded text-xs transition-colors flex-shrink-0 ${
          sub.isDefault
            ? 'bg-primary text-white'
            : 'bg-slate-200 text-transparent hover:bg-slate-300'
        }`}
        title={sub.isDefault ? '取消默认' : '设为默认'}
      >
        {sub.isDefault ? '✓' : ''}
      </button>

      {/* 小类名称 */}
      {isEditing ? (
        <input
          type="text"
          value={subEditForm.subName}
          onChange={(e) => onSubEditFormChange({ ...subEditForm, subName: e.target.value })}
          placeholder="小类名称"
          className="text-xs border border-slate-200 rounded-lg px-2 h-8 w-[110px] flex-shrink-0 bg-white focus:outline-none focus:border-primary text-slate-700"
          ref={subNameRef}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onSubEditKeyDown}
        />
      ) : (
        <span
          className="text-sm font-medium text-slate-700 w-[110px] flex-shrink-0 truncate"
          onClick={(e) => { e.stopPropagation(); onStartEdit('subName') }}
        >
          {sub.name}
        </span>
      )}

      {/* 编辑区 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={subEditForm.defaultAmount}
              onChange={(e) => onSubEditFormChange({ ...subEditForm, defaultAmount: e.target.value })}
              placeholder="金额"
              className="w-[90px] text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
              style={{ color: subEditForm.defaultType === 'income' ? '#10b981' : subEditForm.defaultType === 'ignore' ? '#94a3b8' : '#ef4444' }}
              ref={subAmountRef}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onSubEditKeyDown}
            />
            <InlineSelect
              value={subEditForm.defaultPaymentMethod}
              options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
              placeholder="支付方式"
              initialOpen={focusField === 'defaultPaymentMethod'}
              textColor="text-slate-500"
              ref={subPayRef}
              className="w-[90px] flex-shrink-0"
              onChange={(v) => {
                // 已有小类：选完即自动保存退出编辑
                const newForm = { ...subEditForm, defaultPaymentMethod: v }
                onSubEditFormChange(newForm)
                onAutoSave(newForm)
              }}
            />
            <InlineSelect
              value={subEditForm.defaultType}
              options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
              initialOpen={focusField === 'defaultType'}
              textColor="text-slate-600"
              ref={subTypeRef}
              className="w-[80px] flex-shrink-0"
              onChange={(v) => {
                // 已有小类：选完即自动保存退出编辑
                const newForm = { ...subEditForm, defaultType: v as TransactionType }
                onSubEditFormChange(newForm)
                onAutoSave(newForm)
              }}
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={subEditForm.defaultNote}
                onChange={(e) => onSubEditFormChange({ ...subEditForm, defaultNote: e.target.value })}
                placeholder="备注"
                className="w-full text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-slate-700"
                ref={subNoteRef}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={onSubEditKeyDown}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold tabular-nums w-[100px] text-right flex-shrink-0 ${
                sub.defaultType === 'income' ? 'text-emerald-500' : sub.defaultType === 'ignore' ? 'text-slate-400' : 'text-expense'
              }`}
              onClick={(e) => { e.stopPropagation(); onStartEdit('defaultAmount') }}
            >
              {sub.defaultAmount > 0
                ? `${sub.defaultType === 'income' ? '+' : sub.defaultType === 'ignore' ? '' : '-'}¥${sub.defaultAmount.toFixed(2)}`
                : ''
              }
            </span>
            {sub.defaultPaymentMethod ? (
              <span
                className="inline-flex items-center gap-0.5 text-sm text-slate-400 bg-slate-100 px-2 py-1 rounded-full flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onStartEdit('defaultPaymentMethod') }}
              >
                {(() => {
                  const pm = paymentMethods.find((p) => p.name === sub.defaultPaymentMethod)
                  return pm ? pm.icon : ''
                })()}
                {sub.defaultPaymentMethod}
              </span>
            ) : (
              <span
                className="w-[90px] flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onStartEdit('defaultPaymentMethod') }}
              />
            )}
            <span
              className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full flex-shrink-0 ${
                sub.defaultType === 'income'
                  ? 'text-emerald-600 bg-emerald-50'
                  : sub.defaultType === 'ignore'
                  ? 'text-slate-500 bg-slate-200'
                  : 'text-red-500 bg-red-50'
              }`}
              onClick={(e) => { e.stopPropagation(); onStartEdit('defaultType') }}
            >
              {sub.defaultType === 'income' ? '💰 收入' : sub.defaultType === 'ignore' ? '⏭️ 不计' : '💸 支出'}
            </span>
            <div
              className="flex-1 min-w-0"
              onClick={(e) => { e.stopPropagation(); onStartEdit('defaultNote') }}
            >
              <span className="text-sm text-slate-400 truncate block">
                {sub.defaultNote || '-'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 删除按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
          isEditing
            ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
            : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
        }`}
        title="删除小类"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function CategoryManager() {
  const {
    categories,
    loading,
    addCategory,
    deleteCategory,
    updateCategoryName,
    updateCategoryIcon,
    addSubCategory,
    deleteSubCategory,
    toggleSubCategoryDefault,
    updateSubCategoryDefaults,
    updateSubCategoryName,
    reorderCategories,
    reorderSubCategories,
  } = useCategories()

  const { paymentMethods, txTypes } = useSettings()

  // 展开/折叠状态 — 默认全部折叠
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // 新增小类（行内编辑）
  const [pendingAddCatId, setPendingAddCatId] = useState<number | null>(null)

  // 新增大类
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState(EMOJI_LIST[0])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // 编辑大类名称
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  // 修改大类图标
  const [iconPickerCatId, setIconPickerCatId] = useState<number | null>(null)

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'subcategory'; id: number; name: string } | null>(null)

  // 编辑小类（名称 + 默认模板）
  const [editingSubId, setEditingSubId] = useState<number | null>(null)
  const [subEditForm, setSubEditForm] = useState({ subName: '', defaultNote: '', defaultPaymentMethod: '', defaultAmount: '', defaultType: 'expense' as TransactionType })
  // 进入编辑时聚焦哪个字段（点哪个格子聚焦哪个）
  const [focusField, setFocusField] = useState<EditField | null>(null)
  const subEditRef = useRef<HTMLDivElement>(null)
  const editingSubIdRef = useRef<number | null>(null)
  const subEditFormRef = useRef(subEditForm)

  // 拖拽状态
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  editingSubIdRef.current = editingSubId
  subEditFormRef.current = subEditForm

  // 保存小类编辑（名称 + 默认值）
  const doSaveSub = useCallback(async (id: number, form: typeof subEditForm) => {
    if (id === -1 && pendingAddCatId !== null) {
      // 新增小类
      if (form.subName.trim()) {
        await addSubCategory(pendingAddCatId, form.subName.trim())
      }
      setPendingAddCatId(null)
    } else if (id > 0) {
      // 已有小类 — 更新名称
      if (form.subName.trim()) {
        await updateSubCategoryName(id, form.subName.trim())
      }
      // 更新默认值模板
      await updateSubCategoryDefaults(id, {
        defaultNote: form.defaultNote,
        defaultPaymentMethod: form.defaultPaymentMethod,
        defaultAmount: evaluateExpression(form.defaultAmount) || 0,
        defaultType: form.defaultType,
      })
    }
    // 保存期间用户可能已切到别的行/新增行，避免误关
    if (editingSubIdRef.current === id) {
      setEditingSubId(null)
      setFocusField(null)
    }
  }, [pendingAddCatId, addSubCategory, updateSubCategoryName, updateSubCategoryDefaults])

  // 点击行外自动保存
  useEffect(() => {
    if (editingSubId === null) return
    const handleClickOutside = (e: MouseEvent) => {
      if (subEditRef.current && !subEditRef.current.contains(e.target as Node)) {
        const id = editingSubIdRef.current
        if (id === null) return
        doSaveSub(id, subEditFormRef.current)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingSubId, doSaveSub])

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      await addCategory(newCatName.trim(), newCatIcon)
      setNewCatName('')
      setNewCatIcon(EMOJI_LIST[0])
    } catch (err) {
      alert('添加失败：' + String(err))
    }
  }

  const handleSaveCategoryName = async (id: number) => {
    if (!editingCatName.trim()) return
    try {
      await updateCategoryName(id, editingCatName.trim())
      setEditingCatId(null)
    } catch (err) {
      alert('修改失败：' + String(err))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'category') {
        await deleteCategory(deleteTarget.id)
      } else {
        await deleteSubCategory(deleteTarget.id)
      }
    } catch (err) {
      alert('删除失败：' + String(err))
    }
    setDeleteTarget(null)
  }

  const handleEmojiSelect = (emoji: string) => {
    if (iconPickerCatId !== null) {
      updateCategoryIcon(iconPickerCatId, emoji)
      setIconPickerCatId(null)
    } else {
      setNewCatIcon(emoji)
      setShowEmojiPicker(false)
    }
  }

  const startEditSub = (sub: { id: number; name: string; isDefault: boolean; defaultNote: string; defaultPaymentMethod: string; defaultAmount: number; defaultType: TransactionType }, field: EditField = 'subName') => {
    setEditingSubId(sub.id)
    setFocusField(field)
    setSubEditForm({
      subName: sub.name,
      defaultNote: sub.defaultNote || '',
      defaultPaymentMethod: sub.defaultPaymentMethod || '',
      defaultAmount: sub.defaultAmount ? sub.defaultAmount.toString() : '',
      defaultType: sub.defaultType || 'expense',
    })
  }

  const handleAddSubClick = (catId: number) => {
    setPendingAddCatId(catId)
    setEditingSubId(-1)
    setFocusField(null)
    setSubEditForm({ subName: '', defaultNote: '', defaultPaymentMethod: '', defaultAmount: '', defaultType: 'expense' })
  }

  const handleSubEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const id = editingSubIdRef.current
      if (id === null) return
      doSaveSub(id, subEditFormRef.current)
    }
  }

  // ===== 拖拽事件处理 =====
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    if (activeStr.startsWith('cat-') && overStr.startsWith('cat-')) {
      // 大类拖拽排序
      const ids = categories.map((c) => c.id)
      const oldIdx = ids.indexOf(parseInt(activeStr.replace('cat-', '')))
      const newIdx = ids.indexOf(parseInt(overStr.replace('cat-', '')))
      if (oldIdx !== -1 && newIdx !== -1) {
        reorderCategories(arrayMove(ids, oldIdx, newIdx))
      }
    } else if (activeStr.startsWith('sub-') && overStr.startsWith('sub-')) {
      // 小类拖拽排序
      const activeSubId = parseInt(activeStr.replace('sub-', ''))
      const overSubId = parseInt(overStr.replace('sub-', ''))
      // 找到同时包含这两个小类的大类
      for (const cat of categories) {
        const subIds = cat.children.map((s) => s.id)
        if (subIds.includes(activeSubId) && subIds.includes(overSubId)) {
          const oldIdx = subIds.indexOf(activeSubId)
          const newIdx = subIds.indexOf(overSubId)
          if (oldIdx !== -1 && newIdx !== -1) {
            reorderSubCategories(arrayMove(subIds, oldIdx, newIdx))
          }
          break
        }
      }
    }
  }

  const handleDragCancel = () => setActiveDragId(null)

  // 拖拽中的浮层内容
  const dragOverlayContent = (() => {
    if (!activeDragId) return null
    if (activeDragId.startsWith('cat-')) {
      const id = parseInt(activeDragId.replace('cat-', ''))
      const cat = categories.find((c) => c.id === id)
      if (!cat) return null
      return (
        <div className="bg-white rounded-xl border border-primary/30 shadow-lg px-4 py-3 flex items-center gap-2">
          <span className="text-lg">{cat.icon}</span>
          <span className="text-sm font-semibold text-slate-700">{cat.name}</span>
          <span className="text-[11px] text-slate-400">{cat.children.length}个子类</span>
        </div>
      )
    }
    if (activeDragId.startsWith('sub-')) {
      const id = parseInt(activeDragId.replace('sub-', ''))
      for (const cat of categories) {
        const sub = cat.children.find((s) => s.id === id)
        if (sub) {
          return (
            <div className="bg-white rounded-lg border border-primary/30 shadow-lg px-4 py-2 flex items-center gap-2">
              <span className="text-sm text-slate-700">{sub.name}</span>
            </div>
          )
        }
      }
    }
    return null
  })()

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-400 text-base">加载中...</div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">分类管理</h2>
        <span className="text-xs text-slate-400">{categories.length} 个大类</span>
      </div>

      {/* 分类列表 */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-base">暂无分类，请在下方添加</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={categories.map((c) => `cat-${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map((cat) => {
                const isExpanded = expanded.has(cat.id)
                return (
                  <SortableCategoryRow
                    key={cat.id}
                    id={`cat-${cat.id}`}
                    cat={cat}
                    isExpanded={isExpanded}
                    editingCatId={editingCatId}
                    editingCatName={editingCatName}
                    iconPickerCatId={iconPickerCatId}
                    pendingAddCatId={pendingAddCatId}
                    onToggleExpanded={() => toggleExpanded(cat.id)}
                    onStartEditName={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
                    onChangeEditName={setEditingCatName}
                    onSaveName={() => handleSaveCategoryName(cat.id)}
                    onIconPicker={() => setIconPickerCatId(iconPickerCatId === cat.id ? null : cat.id)}
                    onEmojiSelect={handleEmojiSelect}
                    onCloseIconPicker={() => setIconPickerCatId(null)}
                    onDelete={() => setDeleteTarget({ type: 'category', id: cat.id, name: cat.name })}
                    onAddSub={() => handleAddSubClick(cat.id)}
                  >
                    {/* 小类列表 */}
                    {cat.children.length === 0 && pendingAddCatId !== cat.id ? (
                      <div className="px-4 py-3 text-sm text-slate-400 text-center">暂无小类</div>
                    ) : (
                      <SortableContext
                        items={cat.children.map((s) => `sub-${s.id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        {cat.children.map((sub) => {
                          const isEditing = editingSubId === sub.id
                          return (
                            <SortableSubCategoryRow
                              key={sub.id}
                              id={`sub-${sub.id}`}
                              sub={sub}
                              isEditing={isEditing}
                              editingSubId={editingSubId}
                              subEditForm={subEditForm}
                              subEditRef={subEditRef}
                              focusField={focusField}
                              onToggleDefault={() => toggleSubCategoryDefault(sub.id, !sub.isDefault)}
                              onStartEdit={(field) => !isEditing && startEditSub(sub, field)}
                              onSubEditFormChange={setSubEditForm}
                              onSubEditKeyDown={handleSubEditKeyDown}
                              onAutoSave={(form) => doSaveSub(sub.id, form)}
                              onDelete={() => setDeleteTarget({ type: 'subcategory', id: sub.id, name: sub.name })}
                            />
                          )
                        })}
                      </SortableContext>
                    )}

                    {/* 新增小类的临时编辑行 */}
                    {pendingAddCatId === cat.id && editingSubId === -1 && (
                      <div
                        ref={subEditRef}
                        className="flex items-center gap-2 px-2 pl-2 py-1 text-base bg-indigo-50 border-l-2 border-l-primary border-b border-slate-50"
                      >
                        <div className="w-6 flex-shrink-0" />
                        <div className="w-4 flex-shrink-0" />
                        <input
                          type="text"
                          value={subEditForm.subName}
                          onChange={(e) => setSubEditForm({ ...subEditForm, subName: e.target.value })}
                          placeholder="小类名称"
                          className="text-xs border border-slate-200 rounded-lg px-2 h-8 w-[110px] flex-shrink-0 bg-white focus:outline-none focus:border-primary text-slate-700"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={handleSubEditKeyDown}
                          autoFocus
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={subEditForm.defaultAmount}
                              onChange={(e) => setSubEditForm({ ...subEditForm, defaultAmount: e.target.value })}
                              placeholder="金额"
                              className="w-[90px] text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
                              style={{ color: subEditForm.defaultType === 'income' ? '#10b981' : subEditForm.defaultType === 'ignore' ? '#94a3b8' : '#ef4444' }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={handleSubEditKeyDown}
                            />
                            <InlineSelect
                              value={subEditForm.defaultPaymentMethod}
                              options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
                              placeholder="支付方式"
                              textColor="text-slate-500"
                              className="w-[90px] flex-shrink-0"
                              onChange={(v) => setSubEditForm({ ...subEditForm, defaultPaymentMethod: v })}
                            />
                            <InlineSelect
                              value={subEditForm.defaultType}
                              options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
                              textColor="text-slate-600"
                              className="w-[80px] flex-shrink-0"
                              onChange={(v) => setSubEditForm({ ...subEditForm, defaultType: v as TransactionType })}
                            />
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={subEditForm.defaultNote}
                                onChange={(e) => setSubEditForm({ ...subEditForm, defaultNote: e.target.value })}
                                placeholder="备注"
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-slate-700"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={handleSubEditKeyDown}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="w-7 flex-shrink-0" />
                      </div>
                    )}
                  </SortableCategoryRow>
                )
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {dragOverlayContent}
          </DragOverlay>
        </DndContext>
      )}

      {/* ========== 新增大类区域 ========== */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">新增大类</h3>
        <div className="flex items-end gap-2 relative">
          {/* Emoji 选择器 */}
          <IconPickerButton
            icon={newCatIcon}
            open={showEmojiPicker}
            onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
            onPick={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />

          {/* 名称输入 */}
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
            placeholder="输入大类名称"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary"
          />

          {/* 添加按钮 */}
          <button
            onClick={handleAddCategory}
            disabled={!newCatName.trim()}
            className="flex-shrink-0 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <ConfirmDialog
          title={`删除${deleteTarget.type === 'category' ? '大类' : '小类'}`}
          message={
            deleteTarget.type === 'category'
              ? `确定要删除「${deleteTarget.name}」吗？其下的所有小类也会被删除，已有消费记录不受影响。`
              : `确定要删除小类「${deleteTarget.name}」吗？已有消费记录不受影响。`
          }
          confirmText="删除"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
