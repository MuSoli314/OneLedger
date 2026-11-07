// 分类管理页「可拖拽的小类行」
//
// 主行 = 拖拽手柄 + `>` 尖头 + ✓ 默认开关 + 日常/非日常 + 名称 + 公共属性（支付方式/收支类型/备注）+ 规则条数（已启用/总计）+ 删除。
// 规则区的开关有两处（都点得开）：左边 `>` 尖头、右边「已启用/总计」数字。
// 金额不在主行上：小类的金额只来自「条件规则」，点 `>` 展开后在规则行里改（见 SubcategoryRuleList）。
// 规则区展开/收起只是界面状态（默认收起），不写数据库。
import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useSettings } from '../contexts/SettingsContext'
import { useCategories } from '../contexts/CategoryContext'
import type { TransactionType } from '../data/types'
import InlineSelect from './InlineSelect'
import DragHandle from './DragHandle'
import HoverTip from './HoverTip'
import SubcategoryRuleList from './SubcategoryRuleList'
import { SORTABLE_TRANSITION, sortableRowStyle } from './sortableConfig'

/** 小类行内编辑可聚焦的字段（金额已移到规则里，不在这里） */
export type EditField = 'sub_name' | 'default_payment_method' | 'default_type' | 'default_note'

/** 小类行内编辑表单（名称 + 公共属性，字符串形态） */
export interface SubEditForm {
  sub_name: string
  default_note: string
  default_payment_method: string
  default_type: TransactionType
  default_is_non_daily: boolean
}

interface Props {
  id: string
  sub: { id: number; name: string; is_default: boolean; default_note: string; default_payment_method: string; default_type: TransactionType; default_is_non_daily: boolean }
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
    transition: SORTABLE_TRANSITION,
  })
  const { paymentMethods, txTypes } = useSettings()
  // 规则条数从全局 Context 拿（数据库写规则后 Context 会刷新，这里自动更新）
  const { rulesBySub } = useCategories()
  const rules = rulesBySub[sub.id] ?? []
  const ruleCount = rules.length
  const enabledRuleCount = rules.filter((r) => r.enabled).length
  // 规则区是否展开：纯内存状态，默认收起
  const [rulesExpanded, setRulesExpanded] = useState(false)

  // 拖拽中不改变任何外观，只让整行跟着指针上下移动（详见 sortableConfig.ts）
  const style = sortableRowStyle(transform, transition, isDragging)

  // 编辑控件 refs，按 focusField 聚焦
  const subNameRef = useRef<HTMLInputElement | null>(null)
  const subPayRef = useRef<HTMLButtonElement | null>(null)
  const subTypeRef = useRef<HTMLButtonElement | null>(null)
  const subNoteRef = useRef<HTMLInputElement | null>(null)

  // 进入编辑态后按 focusField 聚焦对应编辑控件
  useEffect(() => {
    if (!isEditing) return
    const refMap: Record<EditField, React.RefObject<HTMLInputElement | HTMLButtonElement | null>> = {
      sub_name: subNameRef,
      default_payment_method: subPayRef,
      default_type: subTypeRef,
      default_note: subNoteRef,
    }
    const el = refMap[focusField || 'sub_name']?.current
    if (!el) return
    el.focus()
    // 自由输入框（小类名/默认备注）进入编辑时全选已有内容，方便直接输入替换；下拉按钮无需处理
    if (el instanceof HTMLInputElement) el.select()
    // oxlint 误报 focusField 非响应式，实际是父组件传入的 props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, focusField])

  return (
    // 外层是「整张小类卡片」：主行 +（展开时的）规则区；拖拽时整块一起移动
    <div
      ref={isEditing && editingSubId !== -1 ? subEditRef : setNodeRef}
      style={isEditing && editingSubId !== -1 ? undefined : style}
      className="border-b border-slate-50 group"
    >
      {/* 主行：点空白处进入编辑（`>` / ✓ / 日常 / 删除 都已单独拦截点击，不会触发编辑） */}
      <div
        onClick={() => onStartEdit()}
        className={`flex items-center gap-2 px-2 pl-2 py-1 text-base transition-colors ${
          isEditing
            ? 'bg-indigo-50 border-l-2 border-l-primary'
            : sub.default_type === 'ignore'
            ? 'bg-slate-300 hover:bg-slate-400 cursor-pointer'
            : 'hover:bg-slate-50 cursor-pointer'
        }`}
      >
        {/* 拖拽手柄（拖小类之间的顺序） */}
        {isEditing ? (
          <div className="w-6 flex-shrink-0" />
        ) : (
          <DragHandle
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* 规则区开关（左）：`>` 尖头，展开时转 90°；右边「已启用/总计」数字也是开关 */}
        <HoverTip text={rulesExpanded ? '收起规则' : '展开规则'} className="shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation() // 不触发主行的「进入编辑」
              setRulesExpanded((v) => !v)
            }}
            className={`flex items-center h-6 px-0.5 rounded transition-colors ${
              rulesExpanded
                ? 'text-primary bg-primary/10'
                : 'text-slate-400 hover:text-primary hover:bg-primary/10'
            }`}
          >
            <svg
              className={`w-3 h-3 transition-transform ${rulesExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </HoverTip>

        {/* 默认开关（总开关：不勾 = 这个小类不参与自动记账） */}
        <HoverTip text={sub.is_default ? '取消默认' : '设为默认'} className="shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleDefault() }}
            className={`w-4 h-4 flex items-center justify-center rounded text-xs transition-colors ${
              sub.is_default
                ? 'bg-primary text-white'
                : 'bg-slate-200 text-transparent hover:bg-slate-300'
            }`}
          >
            {sub.is_default ? '✓' : ''}
          </button>
        </HoverTip>

        {/* 日常/非日常标记（固定在最前，与记账列表一致；点击切换立即保存）——固定宽度，两态一致不跳动 */}
        <HoverTip
          text={(isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily) ? '默认非日常（点击改为日常）' : '默认日常（点击改为非日常）'}
          className="shrink-0"
        >
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
            className={`w-[52px] h-6 flex-shrink-0 flex items-center justify-center rounded-md text-sm transition-colors ${
              (isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily)
                ? 'bg-slate-200 text-slate-500'
                : 'bg-transparent text-slate-300 border border-dashed border-slate-200 hover:border-slate-300 hover:text-slate-400'
            }`}
          >
            {(isEditing ? subEditForm.default_is_non_daily : sub.default_is_non_daily) ? '非日常' : '日常'}
          </button>
        </HoverTip>

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

        {/* 公共属性区（支付方式 / 收支类型 / 备注；金额已移到规则里） */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
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

        {/* 规则条数：已启用 / 总共有几条（0 条也显示 0/0）；点一下展开 / 收起规则区 */}
        <HoverTip
          text={
            ruleCount === 0
              ? '规则 0/0：这个小类还没有规则，点开可以添加'
              : rulesExpanded
                ? `收起规则（${enabledRuleCount} 条启用 / 共 ${ruleCount} 条）`
                : `展开规则（${enabledRuleCount} 条启用 / 共 ${ruleCount} 条，从上往下匹配，命中第一条即用）`
          }
          className="shrink-0"
          align="right"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation() // 不触发主行的「进入编辑」
              setRulesExpanded((v) => !v)
            }}
            className={`w-[44px] flex-shrink-0 text-right text-[11px] tabular-nums leading-none py-1 rounded transition-colors ${
              rulesExpanded
                ? 'text-primary font-medium'
                : ruleCount === 0
                  ? 'text-slate-300 hover:text-primary'
                  : 'text-slate-400 hover:text-primary'
            }`}
          >
            {enabledRuleCount}/{ruleCount}
          </button>
        </HoverTip>

        {/* 删除按钮 */}
        <HoverTip text="删除小类" className="shrink-0" align="right">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              isEditing
                ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </HoverTip>
      </div>

      {/* 规则区：展开时挂在主行下面，仍然是这个小类卡片的一部分 */}
      {rulesExpanded && <SubcategoryRuleList subId={sub.id} />}
    </div>
  )
}
