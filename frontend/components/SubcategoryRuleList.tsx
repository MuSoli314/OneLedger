// 小类条件规则列表（小类主行展开后，显示在主行下面的那一块）
//
// 一条规则 = 启用勾选 + 条件 + 金额；顺序就是优先级：从上往下匹配，命中第一条即用。
// 这一块独立成一个组件，避免 SortableSubCategoryRow 越写越长。
//
// 拖拽排序沿用项目的四条铁律（见 sortableConfig.ts）：
//  不用 <DragOverlay>、乐观更新、批量落库（reorderSubcategoryRules）、鼠标/触摸分开的传感器。
// 注意：规则列表嵌在小类列表里，所以要自己套一层 DndContext；给它一个独有的 id，
// 避免和外面那一层 DndContext 的 id 撞车（dnd-kit 要求嵌套的上下文 id 唯一）。
import { useEffect, useRef, useState } from 'react'
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
import { useCategories } from '../contexts/CategoryContext'
import { describeConditions, isAlwaysRule } from '../data/subcategoryRules'
import { evaluateExpression } from '../data/calcUtils'
import type { RuleCondition, SubcategoryRule } from '../data/types'
import DragHandle from './DragHandle'
import HoverTip from './HoverTip'
import RuleConditionPanel from './RuleConditionPanel'
import { SORTABLE_TRANSITION, restrictToVerticalAxis, sortableRowStyle, useSortableSensors } from './sortableConfig'

/** 单条可拖拽的规则行（☑ 启用 / 条件标签 / 金额 / ✕ 删除，点条件标签展开条件面板） */
function SortableRuleRow({
  rule,
  showAlwaysWarning,
  onToggleEnabled,
  onChangeConditions,
  onChangeAmount,
  onDelete,
}: {
  rule: SubcategoryRule
  /** 是否显示「这条总是规则会让下面的规则永远不生效」的琥珀色提示 */
  showAlwaysWarning: boolean
  onToggleEnabled: () => void
  onChangeConditions: (conditions: RuleCondition[]) => void
  onChangeAmount: (amount: number) => void
  onDelete: () => void
}) {
  // 规则行自己也是一个可拖拽项；id 加 rule- 前缀，和外面小类行的 sub- id 区分开
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `rule-${rule.id}`,
    transition: SORTABLE_TRANSITION,
  })
  const style = sortableRowStyle(transform, transition, isDragging)

  // 条件面板是否展开（纯界面状态，不落库）
  const [panelOpen, setPanelOpen] = useState(false)
  // 金额是否在编辑中 + 编辑中的草稿文本
  const [amountEditing, setAmountEditing] = useState(false)
  const [amountDraft, setAmountDraft] = useState('')
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  // 整条规则（含展开的面板）的容器，用来判断「点到面板外面了就收起」
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // 点面板外面的任何地方 → 收起条件面板（不用弹窗/portal，行内展开更直观）
  useEffect(() => {
    if (!panelOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [panelOpen])

  // 进入金额编辑时自动聚焦并全选，用户直接输入就能替换
  useEffect(() => {
    if (!amountEditing) return
    amountInputRef.current?.focus()
    amountInputRef.current?.select()
  }, [amountEditing])

  const startAmountEdit = () => {
    setAmountDraft(rule.amount.toString())
    setAmountEditing(true)
  }

  // 回车 / 失焦保存：支持算式（如 5*2），负数拦截，0 允许（0 = 占位提醒）
  const commitAmount = () => {
    if (!amountEditing) return
    setAmountEditing(false)
    const text = amountDraft.trim()
    if (!text) return // 清空 = 放弃这次修改，保留原金额
    const value = evaluateExpression(text)
    if (value === null) {
      alert('金额格式不对，请重新输入（支持 12、12.5、5*2 这样的写法）')
      return
    }
    if (value < 0) {
      alert('金额不能为负数')
      return
    }
    if (value !== rule.amount) onChangeAmount(value)
  }

  return (
    // 拖拽节点的 ref / transform 必须落在同一个元素上，dnd-kit 的落位动画才对
    <div ref={setNodeRef} style={style}>
      {/* 外面再包一层，用来判断「点到面板外面了就收起」（里面包含规则行 + 条件面板） */}
      <div ref={wrapRef}>
        <div className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-slate-100/80">
          {/* 拖拽手柄：拖动 = 调整这条规则的优先级 */}
          <DragHandle {...attributes} {...listeners} />

          {/* 启用勾选：勾掉 = 规则保留但暂时不参与匹配（不是删除） */}
          <HoverTip text={rule.enabled ? '已启用（点击暂停这条规则）' : '已暂停（点击重新启用）'} className="shrink-0">
            <button
              type="button"
              onClick={onToggleEnabled}
              className={`w-4 h-4 flex items-center justify-center rounded text-xs transition-colors ${
                rule.enabled ? 'bg-primary text-white' : 'bg-slate-200 text-transparent hover:bg-slate-300'
              }`}
            >
              {rule.enabled ? '✓' : ''}
            </button>
          </HoverTip>

          {/* 条件标签：点开条件面板；文字直接用 describeConditions 生成，不在界面里自己拼 */}
          <HoverTip text="点击修改这条规则的生效条件" className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className={`w-full text-left text-xs px-2 py-1 rounded-md border transition-colors truncate ${
                panelOpen
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              } ${rule.enabled ? '' : 'opacity-60'}`}
            >
              {describeConditions(rule.conditions)}
            </button>
          </HoverTip>

          {/* 金额：点一下行内编辑；0 元显示 -¥0.00 并提示这是占位（颜色沿用支出红） */}
          {amountEditing ? (
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onBlur={commitAmount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitAmount()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setAmountEditing(false)
                }
              }}
              className="w-[100px] flex-shrink-0 text-sm text-right font-semibold tabular-nums border border-slate-200 rounded-md px-2 h-7 bg-white focus:outline-none focus:border-primary text-expense"
            />
          ) : (
            <HoverTip
              text={rule.amount === 0 ? '金额是 0 元：会自动记一条 ¥0 占位，点这里可修改' : '点击修改金额'}
              className="shrink-0"
              align="right"
            >
              <button
                type="button"
                onClick={startAmountEdit}
                className={`w-[100px] text-right text-sm font-semibold tabular-nums text-expense ${
                  rule.enabled ? '' : 'opacity-60'
                }`}
              >
                -¥{rule.amount.toFixed(2)}
              </button>
            </HoverTip>
          )}

          {/* 删除这条规则 */}
          <HoverTip text="删除这条规则" className="shrink-0" align="right">
            <button
              type="button"
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </HoverTip>
        </div>

        {/* 安全提示：一条「总是」规则排在中间，会把下面的规则全部挡住（匹配到它就停了） */}
        {showAlwaysWarning && (
          <div className="pl-12 pr-2 pb-1 text-[11px] text-amber-600">
            这条会匹配所有日期，它下面的规则永远不会生效
          </div>
        )}

        {/* 条件面板（点条件标签展开，点面板外收起） */}
        {panelOpen && (
          <div className="px-1.5 pb-1.5">
            <RuleConditionPanel conditions={rule.conditions} onChange={onChangeConditions} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function SubcategoryRuleList({ subId }: { subId: number }) {
  const { rulesBySub, addRule, updateRule, deleteRule, reorderRules } = useCategories()
  const rules = rulesBySub[subId] ?? []
  const sensors = useSortableSensors()

  // 松手后排新顺序：先改 state（乐观更新）再落库，动画才不会飞回旧位置
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = rules.map((r) => `rule-${r.id}`)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const orderedIds = arrayMove(ids, oldIndex, newIndex).map((id) => parseInt(id.replace('rule-', ''), 10))
    reorderRules(subId, orderedIds)
  }

  return (
    // 规则区 = 挂在小类主行下面的一层「子分组」：缩进一格 + 浅灰底小卡片（与条件面板的 Module 同一套视觉语言），
    // 一眼就能看出这些规则属于上面那个小类。缩进量对齐小类主行的第一个控件列（`>` 尖头那一列），
    // 规则行的勾选框落在主行 ✓ 的右边；手机上（sm 以下）窄，缩进收小一点，免得把条件框挤得太短。
    <div className="ml-4 sm:ml-12 mt-0.5 mb-2 mr-1 rounded-lg border border-slate-200/60 bg-slate-50 p-1 sm:p-1.5">
      {rules.length === 0 && (
        <div className="text-[11px] text-slate-400 px-1.5 py-1">这个小类不会被自动记账</div>
      )}

      {/* 嵌套的拖拽上下文：id 必须和外面小类列表的那一层不同 */}
      <DndContext
        id={`rule-dnd-${subId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rules.map((r) => `rule-${r.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {rules.map((rule, index) => (
              <SortableRuleRow
                key={rule.id}
                rule={rule}
                // 只有「已启用的总是规则 + 下面还有别的规则」才提示，规则被暂停时不会挡住别人
                showAlwaysWarning={rule.enabled && isAlwaysRule(rule.conditions) && index < rules.length - 1}
                onToggleEnabled={() => { void updateRule(rule.id, { enabled: !rule.enabled }) }}
                onChangeConditions={(conditions) => { void updateRule(rule.id, { conditions }) }}
                onChangeAmount={(amount) => { void updateRule(rule.id, { amount }) }}
                onDelete={() => { void deleteRule(rule.id) }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 添加规则：新规则默认「总是」+ ¥0，想要条件规则点它的条件标签去改 */}
      <button
        type="button"
        onClick={() => { void addRule(subId) }}
        className="mt-1 text-xs text-primary hover:text-primary-dark px-1.5 py-1 rounded-md hover:bg-primary/5 transition-colors"
      >
        ＋ 添加规则
      </button>
    </div>
  )
}
