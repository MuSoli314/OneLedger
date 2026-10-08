// 分类管理页「可拖拽的小类行」（默认开关 + 非日常标记 + 名称/默认模板行内编辑 + 删除）
import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useSettings } from '../contexts/SettingsContext'
import type { TransactionType } from '../data/types'
import InlineSelect from './InlineSelect'
import CategoryDragHandle from './CategoryDragHandle'

/** 小类行内编辑可聚焦的字段 */
export type EditField = 'sub_name' | 'default_amount' | 'default_payment_method' | 'default_type' | 'default_note'

/** 小类行内编辑表单（名称 + 默认模板，字符串形态） */
export interface SubEditForm {
  sub_name: string
  default_note: string
  default_payment_method: string
  default_amount: string
  default_type: TransactionType
  default_is_non_daily: boolean
}

interface Props {
  id: string
  sub: { id: number; name: string; is_default: boolean; default_note: string; default_payment_method: string; default_amount: number; default_type: TransactionType; default_is_non_daily: boolean }
  isEditing: boolean
  editingSubId: number | null
  subEditForm: SubEditForm
  subEditRef: React.RefObject<HTMLDivElement | null>
  focusField: EditField | null
  onToggleDefault: () => void
  onToggleNonDaily: () => void
  onStartEdit: (field?: EditField) => void
  onSubEditFormChange: (form: SubEditForm) => void
  onSubEditKeyDown: (e: React.KeyboardEvent) => void
  /** 下拉选择后自动保存（选完即存并退出编辑） */
  onAutoSave: (form: SubEditForm) => void
  onDelete: () => void
}

export default function SortableSubCategoryRow({
  id,
  sub,
  isEditing,
  editingSubId,
  subEditForm,
  subEditRef,
  focusField,
  onToggleDefault,
  onToggleNonDaily,
  onStartEdit,
  onSubEditFormChange,
  onSubEditKeyDown,
  onAutoSave,
  onDelete,
}: Props) {
  // 让位动画调快一些（默认 200ms 偏拖沓），落位更利落
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  const { paymentMethods, txTypes } = useSettings()

  // 拖拽中不改变任何外观（不加阴影、不改透明度、不换元素），只让整行跟着指针移动。
  // zIndex 是为了让被拖的行盖住相邻行（transform 会新建层叠上下文，DOM 靠后的行会压住它）。
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
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
      sub_name: subNameRef,
      default_amount: subAmountRef,
      default_payment_method: subPayRef,
      default_type: subTypeRef,
      default_note: subNoteRef,
    }
    const el = refMap[focusField || 'sub_name']?.current
    if (!el) return
    el.focus()
    // 自由输入框（小类名/默认金额/默认备注）进入编辑时全选已有内容，方便直接输入替换；下拉按钮无需处理
    if (el instanceof HTMLInputElement) el.select()
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
          : sub.default_type === 'ignore'
          ? 'bg-slate-300 hover:bg-slate-400 cursor-pointer group'
          : 'hover:bg-slate-50 cursor-pointer group'
      }`}
    >
      {/* 拖拽手柄 */}
      {isEditing ? (
        <div className="w-6 flex-shrink-0" />
      ) : (
        <CategoryDragHandle
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* 默认开关 */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDefault() }}
        className={`w-4 h-4 flex items-center justify-center rounded text-xs transition-colors flex-shrink-0 ${
          sub.is_default
            ? 'bg-primary text-white'
            : 'bg-slate-200 text-transparent hover:bg-slate-300'
        }`}
        title={sub.is_default ? '取消默认' : '设为默认'}
      >
        {sub.is_default ? '✓' : ''}
      </button>

      {/* 日常/非日常标记（固定在最前，与记账列表一致；点击切换立即保存）——固定宽度，两态一致不跳动 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (isEditing) {
            // 编辑态：改表单并自动保存退出编辑（与支付方式/收支类型下拉一致）
            const f = { ...subEditForm, default_is_non_daily: !subEditForm.default_is_non_daily }
            onSubEditFormChange(f)
            onAutoSave(f)
          } else {
            // 非编辑态：立即切换保存（不改其它字段）
            onToggleNonDaily()
          }
        }}
        className={`w-[52px] h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] transition-colors ${
          (isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily)
            ? 'bg-slate-200 text-slate-500'
            : 'bg-transparent text-slate-300 border border-dashed border-slate-200 hover:border-slate-300 hover:text-slate-400'
        }`}
        title={(isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily) ? '默认非日常（点击改为日常）' : '默认日常（点击改为非日常）'}
      >
        {(isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily) ? '非日常' : '日常'}
      </button>

      {/* 小类名称 */}
      {isEditing ? (
        <input
          type="text"
          value={subEditForm.sub_name}
          onChange={(e) => onSubEditFormChange({ ...subEditForm, sub_name: e.target.value })}
          placeholder="小类名称"
          className="text-xs border border-slate-200 rounded-lg px-2 h-8 w-[110px] flex-shrink-0 bg-white focus:outline-none focus:border-primary text-slate-700"
          ref={subNameRef}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onSubEditKeyDown}
        />
      ) : (
        <span
          className="text-sm font-medium text-slate-700 w-[110px] flex-shrink-0 truncate"
          onClick={(e) => { e.stopPropagation(); onStartEdit('sub_name') }}
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
              value={subEditForm.default_amount}
              onChange={(e) => onSubEditFormChange({ ...subEditForm, default_amount: e.target.value })}
              placeholder="金额"
              className="w-[90px] text-xs border border-slate-200 rounded-lg px-2 h-8 bg-white focus:outline-none focus:border-primary text-right font-semibold tabular-nums"
              style={{ color: subEditForm.default_type === 'income' ? '#10b981' : subEditForm.default_type === 'ignore' ? '#94a3b8' : '#ef4444' }}
              ref={subAmountRef}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onSubEditKeyDown}
            />
            <InlineSelect
              value={subEditForm.default_payment_method}
              options={paymentMethods.map((pm) => ({ value: pm.name, label: <span className="inline-flex items-center gap-1">{pm.icon} {pm.name}</span> }))}
              placeholder="支付方式"
              initialOpen={focusField === 'default_payment_method'}
              textColor="text-slate-500"
              ref={subPayRef}
              className="w-[90px] flex-shrink-0"
              onChange={(v) => {
                // 已有小类：选完即自动保存退出编辑
                const newForm = { ...subEditForm, default_payment_method: v }
                onSubEditFormChange(newForm)
                onAutoSave(newForm)
              }}
            />
            <InlineSelect
              value={subEditForm.default_type}
              options={txTypes.map((t) => ({ value: t.code, label: <span className="inline-flex items-center gap-1">{t.icon} {t.name}</span> }))}
              initialOpen={focusField === 'default_type'}
              textColor="text-slate-600"
              ref={subTypeRef}
              className="w-[80px] flex-shrink-0"
              onChange={(v) => {
                // 已有小类：选完即自动保存退出编辑
                const newForm = { ...subEditForm, default_type: v as TransactionType }
                onSubEditFormChange(newForm)
                onAutoSave(newForm)
              }}
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={subEditForm.default_note}
                onChange={(e) => onSubEditFormChange({ ...subEditForm, default_note: e.target.value })}
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
                sub.default_type === 'income' ? 'text-emerald-500' : sub.default_type === 'ignore' ? 'text-slate-400' : 'text-expense'
              }`}
              onClick={(e) => { e.stopPropagation(); onStartEdit('default_amount') }}
            >
              {sub.default_amount >= 0
                ? `${sub.default_type === 'income' ? '+' : sub.default_type === 'ignore' ? '' : '-'}¥${sub.default_amount.toFixed(2)}`
                : ''
              }
            </span>
            {sub.default_payment_method ? (
              <span
                className="inline-flex items-center gap-0.5 w-[90px] flex-shrink-0 text-sm text-slate-400 bg-slate-100 px-2 py-1 rounded-full overflow-hidden whitespace-nowrap"
                onClick={(e) => { e.stopPropagation(); onStartEdit('default_payment_method') }}
              >
                {(() => {
                  const pm = paymentMethods.find((p) => p.name === sub.default_payment_method)
                  return pm ? pm.icon : ''
                })()}
                {sub.default_payment_method}
              </span>
            ) : (
              <span
                className="w-[90px] flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onStartEdit('default_payment_method') }}
              />
            )}
            <span
              className={`inline-flex items-center gap-1 w-[80px] flex-shrink-0 text-sm px-2 py-1 rounded-full overflow-hidden whitespace-nowrap ${
                sub.default_type === 'income'
                  ? 'text-emerald-600 bg-emerald-50'
                  : sub.default_type === 'ignore'
                  ? 'text-slate-500 bg-slate-200'
                  : 'text-red-500 bg-red-50'
              }`}
              onClick={(e) => { e.stopPropagation(); onStartEdit('default_type') }}
            >
              {sub.default_type === 'income' ? '💰 收入' : sub.default_type === 'ignore' ? '⏭️ 不计' : '💸 支出'}
            </span>
            <div
              className="flex-1 min-w-0"
              onClick={(e) => { e.stopPropagation(); onStartEdit('default_note') }}
            >
              <span className="text-sm text-slate-400 truncate block">
                {sub.default_note || '-'}
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
