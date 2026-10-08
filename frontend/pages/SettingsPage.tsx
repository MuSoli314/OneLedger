import { useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { EMOJI_LIST } from '../data/emojis'
import { IconPickerButton } from '../components/EmojiPicker'
import ConfirmDialog from '../components/ConfirmDialog'
import { countExpensesByPaymentMethod, countExpensesByType } from '../data/database'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import type { PaymentMethodConfig, TxTypeConfig, TxCategory } from '../data/types'
import DragHandle from '../components/DragHandle'
import { SORTABLE_TRANSITION, restrictToVerticalAxis, sortableRowStyle, useSortableSensors } from '../components/sortableConfig'

/** 修改名称按钮 */
function EditButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0" title={title}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

/** 删除按钮 */
function DeleteButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0" title={title}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

/** 可拖拽的支付方式行 */
function SortablePaymentRow({
  id,
  pm,
  editing,
  editingName,
  iconOpen,
  onStartEditName,
  onChangeName,
  onSaveName,
  onCancelEditName,
  onToggleIcon,
  onPickEmoji,
  onCloseIcon,
  onDelete,
}: {
  id: string
  pm: PaymentMethodConfig
  editing: boolean
  editingName: string
  iconOpen: boolean
  onStartEditName: () => void
  onChangeName: (v: string) => void
  onSaveName: () => void
  onCancelEditName: () => void
  onToggleIcon: () => void
  onPickEmoji: (e: string) => void
  onCloseIcon: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: SORTABLE_TRANSITION,
  })
  // 拖拽中不改变任何外观，只让整行跟着指针上下移动（详见 sortableConfig.ts）
  const style = sortableRowStyle(transform, transition, isDragging)
  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-2 px-4 py-3 relative">
      <DragHandle {...attributes} {...listeners} />
      {/* 图标按钮（点开 emoji 选择） */}
      <IconPickerButton icon={pm.icon} open={iconOpen} onToggle={onToggleIcon} onPick={onPickEmoji} onClose={onCloseIcon} />
      {/* 名称 */}
      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            autoFocus
            value={editingName}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); if (e.key === 'Escape') onCancelEditName() }}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary min-w-0"
          />
          <button onClick={onSaveName} className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark">保存</button>
          <button onClick={onCancelEditName} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">取消</button>
        </div>
      ) : (
        <span className="text-base font-semibold text-slate-700 flex-1 min-w-0 truncate">{pm.name}</span>
      )}
      <EditButton onClick={onStartEditName} title="修改名称" />
      <DeleteButton onClick={onDelete} title="删除支付方式" />
    </div>
  )
}

/** 类别徽章样式 */
const CATEGORY_BADGE: Record<TxCategory, { label: string; cls: string }> = {
  expense: { label: '计入支出', cls: 'text-red-500 bg-red-50' },
  income: { label: '计入收入', cls: 'text-emerald-600 bg-emerald-50' },
  ignore: { label: '不计数', cls: 'text-slate-500 bg-slate-200' },
}

/** 可拖拽的收支类型行 */
function SortableTxRow({
  id,
  tt,
  editing,
  editingName,
  iconOpen,
  onStartEditName,
  onChangeName,
  onSaveName,
  onCancelEditName,
  onToggleIcon,
  onPickEmoji,
  onCloseIcon,
  onDelete,
}: {
  id: string
  tt: TxTypeConfig
  editing: boolean
  editingName: string
  iconOpen: boolean
  onStartEditName: () => void
  onChangeName: (v: string) => void
  onSaveName: () => void
  onCancelEditName: () => void
  onToggleIcon: () => void
  onPickEmoji: (e: string) => void
  onCloseIcon: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: SORTABLE_TRANSITION,
  })
  // 拖拽中不改变任何外观，只让整行跟着指针上下移动（详见 sortableConfig.ts）
  const style = sortableRowStyle(transform, transition, isDragging)
  const badge = CATEGORY_BADGE[tt.category]
  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-2 px-4 py-3 relative">
      <DragHandle {...attributes} {...listeners} />
      {/* 图标按钮（点开 emoji 选择） */}
      <IconPickerButton icon={tt.icon} open={iconOpen} onToggle={onToggleIcon} onPick={onPickEmoji} onClose={onCloseIcon} />
      {/* 名称 */}
      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            autoFocus
            value={editingName}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); if (e.key === 'Escape') onCancelEditName() }}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary min-w-0"
          />
          <button onClick={onSaveName} className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark">保存</button>
          <button onClick={onCancelEditName} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">取消</button>
        </div>
      ) : (
        <span className="text-base font-semibold text-slate-700 flex-1 min-w-0 truncate">{tt.name}</span>
      )}
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
      <EditButton onClick={onStartEditName} title="修改名称" />
      <DeleteButton onClick={onDelete} title="删除收支类型" />
    </div>
  )
}

/** 新增区域的可复用表单外壳 */
function AddBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="flex items-end gap-2 relative">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const {
    paymentMethods,
    txTypes,
    loading,
    addPaymentMethod,
    deletePaymentMethod,
    updatePaymentMethodName,
    updatePaymentMethodIcon,
    reorderPaymentMethods,
    addTxType,
    deleteTxType,
    updateTxTypeName,
    updateTxTypeIcon,
    reorderTxTypes,
  } = useSettings()

  // —— 支付方式状态 ——
  const [editingPmId, setEditingPmId] = useState<number | null>(null)
  const [editingPmName, setEditingPmName] = useState('')
  const [iconPmId, setIconPmId] = useState<number | null>(null)
  const [newPmName, setNewPmName] = useState('')
  const [newPmIcon, setNewPmIcon] = useState(EMOJI_LIST[0])
  const [showPmPicker, setShowPmPicker] = useState(false)
  const [deletePm, setDeletePm] = useState<{ id: number; name: string; count: number } | null>(null)

  // —— 收支类型状态 ——
  const [editingTtId, setEditingTtId] = useState<number | null>(null)
  const [editingTtName, setEditingTtName] = useState('')
  const [iconTtId, setIconTtId] = useState<number | null>(null)
  const [newTtName, setNewTtName] = useState('')
  const [newTtIcon, setNewTtIcon] = useState(EMOJI_LIST[0])
  const [newTtCategory, setNewTtCategory] = useState<TxCategory>('expense')
  const [showTtPicker, setShowTtPicker] = useState(false)
  const [deleteTt, setDeleteTt] = useState<{ id: number; name: string; count: number } | null>(null)

  // —— 拖拽传感器（鼠标移动 5px / 触摸长按 0.25 秒），统一配置见 sortableConfig.ts ——
  const sensors = useSortableSensors()

  // ===== 支付方式操作 =====
  const handleSavePmName = async () => {
    if (editingPmId === null) return
    const name = editingPmName.trim()
    if (!name) return
    await updatePaymentMethodName(editingPmId, name)
    setEditingPmId(null)
  }

  const handlePickPmEmoji = (emoji: string) => {
    if (iconPmId !== null) {
      updatePaymentMethodIcon(iconPmId, emoji)
      setIconPmId(null)
    } else {
      setNewPmIcon(emoji)
      setShowPmPicker(false)
    }
  }

  const handleAddPm = async () => {
    if (!newPmName.trim()) return
    try {
      await addPaymentMethod(newPmName.trim(), newPmIcon)
      setNewPmName('')
      setNewPmIcon(EMOJI_LIST[0])
    } catch (err) {
      alert('添加失败：' + String(err))
    }
  }

  const handleDeletePmClick = async (pm: PaymentMethodConfig) => {
    const count = await countExpensesByPaymentMethod(pm.name)
    setDeletePm({ id: pm.id, name: pm.name, count })
  }

  const confirmDeletePm = async () => {
    if (!deletePm) return
    try {
      await deletePaymentMethod(deletePm.id)
    } catch (err) {
      alert('删除失败：' + String(err))
    }
    setDeletePm(null)
  }

  // ===== 收支类型操作 =====
  const handleSaveTtName = async () => {
    if (editingTtId === null) return
    const name = editingTtName.trim()
    if (!name) return
    await updateTxTypeName(editingTtId, name)
    setEditingTtId(null)
  }

  const handlePickTtEmoji = (emoji: string) => {
    if (iconTtId !== null) {
      updateTxTypeIcon(iconTtId, emoji)
      setIconTtId(null)
    } else {
      setNewTtIcon(emoji)
      setShowTtPicker(false)
    }
  }

  const handleAddTt = async () => {
    if (!newTtName.trim()) return
    try {
      await addTxType(newTtName.trim(), newTtIcon, newTtCategory)
      setNewTtName('')
      setNewTtIcon(EMOJI_LIST[0])
      setNewTtCategory('expense')
    } catch (err) {
      alert('添加失败：' + String(err))
    }
  }

  const handleDeleteTtClick = async (tt: TxTypeConfig) => {
    const count = await countExpensesByType(tt.code)
    setDeleteTt({ id: tt.id, name: tt.name, count })
  }

  const confirmDeleteTt = async () => {
    if (!deleteTt) return
    try {
      await deleteTxType(deleteTt.id)
    } catch (err) {
      alert('删除失败：' + String(err))
    }
    setDeleteTt(null)
  }

  // ===== 拖拽 =====
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeStr = String(active.id)
    const overStr = String(over.id)
    if (activeStr.startsWith('pm-') && overStr.startsWith('pm-')) {
      const ids = paymentMethods.map((p) => p.id)
      const oldIdx = ids.indexOf(parseInt(activeStr.replace('pm-', '')))
      const newIdx = ids.indexOf(parseInt(overStr.replace('pm-', '')))
      if (oldIdx !== -1 && newIdx !== -1) reorderPaymentMethods(arrayMove(ids, oldIdx, newIdx))
    } else if (activeStr.startsWith('tt-') && overStr.startsWith('tt-')) {
      const ids = txTypes.map((t) => t.id)
      const oldIdx = ids.indexOf(parseInt(activeStr.replace('tt-', '')))
      const newIdx = ids.indexOf(parseInt(overStr.replace('tt-', '')))
      if (oldIdx !== -1 && newIdx !== -1) reorderTxTypes(arrayMove(ids, oldIdx, newIdx))
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-slate-400 text-base">加载中...</div>
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-slate-800">设置</h2>

      {/* 支付方式 + 收支类型 左右两栏 */}
      <div className="grid grid-cols-2 gap-6 items-start">
      {/* ===== 支付方式 ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700">💳 支付方式</h3>
          <span className="text-xs text-slate-400">{paymentMethods.length} 个</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={paymentMethods.map((p) => `pm-${p.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {paymentMethods.map((pm) => (
                <SortablePaymentRow
                  key={pm.id}
                  id={`pm-${pm.id}`}
                  pm={pm}
                  editing={editingPmId === pm.id}
                  editingName={editingPmName}
                  iconOpen={iconPmId === pm.id}
                  onStartEditName={() => { setEditingPmId(pm.id); setEditingPmName(pm.name) }}
                  onChangeName={setEditingPmName}
                  onSaveName={handleSavePmName}
                  onCancelEditName={() => setEditingPmId(null)}
                  onToggleIcon={() => setIconPmId(iconPmId === pm.id ? null : pm.id)}
                  onPickEmoji={handlePickPmEmoji}
                  onCloseIcon={() => setIconPmId(null)}
                  onDelete={() => handleDeletePmClick(pm)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <AddBlock title="新增支付方式">
          <IconPickerButton icon={newPmIcon} open={showPmPicker} onToggle={() => setShowPmPicker(!showPmPicker)} onPick={handlePickPmEmoji} onClose={() => setShowPmPicker(false)} />
          <input
            type="text"
            value={newPmName}
            onChange={(e) => setNewPmName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddPm() }}
            placeholder="输入支付方式名称"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAddPm}
            disabled={!newPmName.trim()}
            className="flex-shrink-0 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </AddBlock>
      </div>

      {/* ===== 收支类型 ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700">💰 收支类型</h3>
          <span className="text-xs text-slate-400">{txTypes.length} 个</span>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={txTypes.map((t) => `tt-${t.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {txTypes.map((tt) => (
                <SortableTxRow
                  key={tt.id}
                  id={`tt-${tt.id}`}
                  tt={tt}
                  editing={editingTtId === tt.id}
                  editingName={editingTtName}
                  iconOpen={iconTtId === tt.id}
                  onStartEditName={() => { setEditingTtId(tt.id); setEditingTtName(tt.name) }}
                  onChangeName={setEditingTtName}
                  onSaveName={handleSaveTtName}
                  onCancelEditName={() => setEditingTtId(null)}
                  onToggleIcon={() => setIconTtId(iconTtId === tt.id ? null : tt.id)}
                  onPickEmoji={handlePickTtEmoji}
                  onCloseIcon={() => setIconTtId(null)}
                  onDelete={() => handleDeleteTtClick(tt)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <AddBlock title="新增收支类型">
          <IconPickerButton icon={newTtIcon} open={showTtPicker} onToggle={() => setShowTtPicker(!showTtPicker)} onPick={handlePickTtEmoji} onClose={() => setShowTtPicker(false)} />
          <input
            type="text"
            value={newTtName}
            onChange={(e) => setNewTtName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTt() }}
            placeholder="输入收支类型名称"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary"
          />
          <select
            value={newTtCategory}
            onChange={(e) => setNewTtCategory(e.target.value as TxCategory)}
            className="flex-shrink-0 text-sm border border-slate-200 rounded-lg px-2 py-2.5 bg-white focus:outline-none focus:border-primary text-slate-600"
          >
            <option value="expense">计入支出</option>
            <option value="income">计入收入</option>
            <option value="ignore">不计数</option>
          </select>
          <button
            onClick={handleAddTt}
            disabled={!newTtName.trim()}
            className="flex-shrink-0 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </AddBlock>
      </div>
      </div>

      {/* 删除确认弹窗 */}
      {deletePm && (
        <ConfirmDialog
          title={`删除支付方式「${deletePm.name}」`}
          message={`确定删除「${deletePm.name}」吗？还有 ${deletePm.count} 笔记录在用（删除后这些记录的图标显示为默认，名称保留）。`}
          confirmText="删除"
          danger
          onConfirm={confirmDeletePm}
          onCancel={() => setDeletePm(null)}
        />
      )}
      {deleteTt && (
        <ConfirmDialog
          title={`删除收支类型「${deleteTt.name}」`}
          message={`确定删除「${deleteTt.name}」吗？删除后 ${deleteTt.count} 笔记录的该类型将显示为「未定义」并掉出所有统计。`}
          confirmText="删除"
          danger
          onConfirm={confirmDeleteTt}
          onCancel={() => setDeleteTt(null)}
        />
      )}
    </div>
  )
}
