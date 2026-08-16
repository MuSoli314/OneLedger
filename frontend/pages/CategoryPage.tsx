// 分类管理页主组件：拖拽编排 + 状态管理 + 页面组合
// （大类行 / 小类行 / 拖拽手柄已拆到独立组件）
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCategories } from '../contexts/CategoryContext'
import { useSettings } from '../contexts/SettingsContext'
import type { TransactionType } from '../data/types'
import { evaluateExpression } from '../data/calcUtils'
import { EMOJI_LIST } from '../data/emojis'
import { IconPickerButton } from '../components/EmojiPicker'
import InlineSelect from '../components/InlineSelect'
import ConfirmDialog from '../components/ConfirmDialog'
import SortableCategoryRow from '../components/SortableCategoryRow'
import SortableSubCategoryRow, { type EditField, type SubEditForm } from '../components/SortableSubCategoryRow'
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
  arrayMove,
} from '@dnd-kit/sortable'

export default function CategoryPage() {
  const {
    categories,
    loading,
    addCategory,
    deleteCategory,
    updateCategoryName,
    updateCategoryIcon,
    toggleCategoryDefault,
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
  const [subEditForm, setSubEditForm] = useState<SubEditForm>({ sub_name: '', default_note: '', default_payment_method: '', default_amount: '', default_type: 'expense' as TransactionType, default_is_non_daily: false })
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
    // 默认金额：支持算式（如 5*2）；空/非法视为 0；负数不允许（与记账行内校验口径一致）
    const default_amount = evaluateExpression(form.default_amount) || 0
    if (default_amount < 0) {
      alert('默认金额不能为负数')
      return
    }
    if (id === -1 && pendingAddCatId !== null) {
      // 新增小类：支付方式/收支类型必填（表单已默认第一项，这里再兜底取第一项）
      if (form.sub_name.trim()) {
        const newId = await addSubCategory(pendingAddCatId, form.sub_name.trim())
        await updateSubCategoryDefaults(newId, {
          default_note: form.default_note,
          default_payment_method: form.default_payment_method || paymentMethods[0]?.name || '',
          default_amount,
          default_type: form.default_type || txTypes[0]?.code || 'expense',
          default_is_non_daily: form.default_is_non_daily,
        })
      }
      setPendingAddCatId(null)
    } else if (id > 0) {
      // 已有小类 — 更新名称
      if (form.sub_name.trim()) {
        await updateSubCategoryName(id, form.sub_name.trim())
      }
      // 更新默认值模板
      await updateSubCategoryDefaults(id, {
        default_note: form.default_note,
        default_payment_method: form.default_payment_method,
        default_amount,
        default_type: form.default_type,
        default_is_non_daily: form.default_is_non_daily,
      })
    }
    // 保存期间用户可能已切到别的行/新增行，避免误关
    if (editingSubIdRef.current === id) {
      setEditingSubId(null)
      setFocusField(null)
    }
  }, [pendingAddCatId, addSubCategory, updateSubCategoryName, updateSubCategoryDefaults, paymentMethods, txTypes])

  // 切换小类默认是否为非日常（非日常 ≠ 默认小类，独立保存）
  const handleToggleSubNonDaily = useCallback(async (id: number, current: boolean) => {
    await updateSubCategoryDefaults(id, { default_is_non_daily: !current })
  }, [updateSubCategoryDefaults])

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

  const startEditSub = (sub: { id: number; name: string; is_default: boolean; default_note: string; default_payment_method: string; default_amount: number; default_type: TransactionType; default_is_non_daily: boolean }, field: EditField = 'sub_name') => {
    setEditingSubId(sub.id)
    setFocusField(field)
    setSubEditForm({
      sub_name: sub.name,
      default_note: sub.default_note || '',
      default_payment_method: sub.default_payment_method || '',
      default_amount: sub.default_amount ? sub.default_amount.toString() : '',
      default_type: sub.default_type || 'expense',
      default_is_non_daily: sub.default_is_non_daily,
    })
  }

  const handleAddSubClick = (catId: number) => {
    setPendingAddCatId(catId)
    setEditingSubId(-1)
    setFocusField(null)
    // 支付方式/收支类型必填：默认取第一项
    setSubEditForm({
      sub_name: '',
      default_note: '',
      default_payment_method: paymentMethods[0]?.name ?? '',
      default_amount: '',
      default_type: txTypes[0]?.code ?? 'expense',
      default_is_non_daily: false,
    })
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

      {/* 说明 */}
      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">
        大类前勾选 ✓ = 该大类参与「添加某天」自动记账；未勾选的大类不会自动添加。小类前勾选 ✓ = 该小类是默认小类（记账时自动带出）。
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
                    onToggleDefault={() => toggleCategoryDefault(cat.id, !cat.is_default)}
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
                              onToggleDefault={() => toggleSubCategoryDefault(sub.id, !sub.is_default)}
                              onToggleNonDaily={() => handleToggleSubNonDaily(sub.id, sub.default_is_non_daily)}
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
                          value={subEditForm.sub_name}
                          onChange={(e) => setSubEditForm({ ...subEditForm, sub_name: e.target.value })}
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
                              value={subEditForm.default_amount}
                              onChange={(e) => setSubEditForm({ ...subEditForm, default_amount: e.target.value })}
                              placeholder="金额"
                              className="w-[90px] text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
                              style={{ color: subEditForm.default_type === 'income' ? '#10b981' : subEditForm.default_type === 'ignore' ? '#94a3b8' : '#ef4444' }}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={handleSubEditKeyDown}
                            />
                            <InlineSelect
                              value={subEditForm.default_payment_method}
                              options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
                              placeholder="支付方式"
                              textColor="text-slate-500"
                              className="w-[90px] flex-shrink-0"
                              onChange={(v) => setSubEditForm({ ...subEditForm, default_payment_method: v })}
                            />
                            <InlineSelect
                              value={subEditForm.default_type}
                              options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
                              textColor="text-slate-600"
                              className="w-[80px] flex-shrink-0"
                              onChange={(v) => setSubEditForm({ ...subEditForm, default_type: v as TransactionType })}
                            />
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSubEditForm({ ...subEditForm, default_is_non_daily: !subEditForm.default_is_non_daily }) }}
                              className={`flex items-center gap-1 px-2 h-8 rounded-lg text-[11px] flex-shrink-0 transition-colors ${
                                subEditForm.default_is_non_daily ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                              title="切换默认是否为非日常支出"
                            >
                              {subEditForm.default_is_non_daily ? '非日常' : '日常'}
                            </button>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={subEditForm.default_note}
                                onChange={(e) => setSubEditForm({ ...subEditForm, default_note: e.target.value })}
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
