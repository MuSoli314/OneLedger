// 分类管理页「可拖拽的大类行」（标题行 + 编辑名称 + 子分类列表插槽 + 图标选择器弹出）
import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { EmojiPickerGrid } from './EmojiPicker'
import DragHandle from './DragHandle'
import { SORTABLE_TRANSITION, sortableRowStyle } from './sortableConfig'

interface Props {
  id: string
  cat: { id: number; name: string; icon: string; is_default: boolean; children: { is_default: boolean }[] }
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
  onToggleDefault: () => void
  children: React.ReactNode
}

export default function SortableCategoryRow({
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
  onToggleDefault,
  children,
}: Props) {
  // 让位动画调快一些（默认 200ms 偏拖沓），落位更利落
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: SORTABLE_TRANSITION,
  })

  // 拖拽中不改变任何外观，只让整行跟着指针上下移动（详见 sortableConfig.ts）
  const style = sortableRowStyle(transform, transition, isDragging)

  const defaultCount = cat.children.filter((c) => c.is_default).length

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
    // ⚠️ 不要加 overflow-hidden：它会把拖到卡片外的小类行裁掉（圆角靠自身 radius 即可，
    // 卡片内没有需要裁剪的实色子元素）。
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-slate-100 shadow-sm">
      {/* 大类标题行 */}
      <div className="flex items-center gap-1 px-4 py-3 pl-2">
        {/* 拖拽手柄 */}
        <DragHandle {...attributes} {...listeners} />

        {/* 默认大类开关：勾选后参与「添加某天」自动记账 */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDefault() }}
          className={`w-5 h-5 flex items-center justify-center rounded-md text-xs transition-colors flex-shrink-0 ${
            cat.is_default
              ? 'bg-primary text-white'
              : 'bg-slate-200 text-transparent hover:bg-slate-300'
          }`}
          title={cat.is_default ? '取消默认（添加某天时不再自动记账该大类）' : '设为默认（添加某天时自动记账该大类）'}
        >
          {cat.is_default ? '✓' : ''}
        </button>

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
