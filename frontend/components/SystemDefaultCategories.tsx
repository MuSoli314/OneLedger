// 分类管理页「系统默认」列：只读展示 App 出厂内置分类，视觉格式与左侧「我的分类」一致，
// 但没有编辑功能（无拖拽/改名/图标/删除，✓ 与 日常/非日常 为只读展示）。
// 数据直接来自 categories.ts 种子清单，不查数据库、不受用户增删改影响；
// 每个大类/小类可一键「恢复」到「我的分类」（由父组件执行添加）。
import { useState } from 'react'
import { categories as defaultCategories, NON_DAILY_DEFAULT_NAMES, DEFAULT_PAYMENT_METHODS } from '../data/categories'

interface Props {
  /** 当前「我的分类」已有的大类名集合（用于把已存在的默认分类置灰） */
  existingCategoryNames: Set<string>
  /** 当前每个大类下已有小类名集合（l1 -> Set<小类名>） */
  existingSubNames: Record<string, Set<string>>
  /** 恢复整个大类（含其全部默认小类） */
  onRestoreCategory: (l1: string) => void
  /** 恢复单个小类（若大类已被删除会自动一并恢复） */
  onRestoreSubCategory: (l1: string, l2: string) => void
}

export default function SystemDefaultCategories({
  existingCategoryNames,
  existingSubNames,
  onRestoreCategory,
  onRestoreSubCategory,
}: Props) {
  // 大类展开/折叠状态 — 默认全部折叠（与左侧一致）
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // 出厂默认模板（与 database.ts 播种一致）：金额 0 / 第一个默认支付方式 / 支出 / 无备注
  const seedPay = DEFAULT_PAYMENT_METHODS[0]?.name ?? ''
  const seedPayIcon = DEFAULT_PAYMENT_METHODS[0]?.icon ?? ''

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 bg-violet-100/90 rounded-full px-2.5 py-1">🏷️ 系统默认</span>
        <span className="text-xs text-slate-400">出厂内置分类，仅供查看；可点「＋ 恢复」加入「我的分类」</span>
      </div>

      {defaultCategories.map((cat) => {
        const catExists = existingCategoryNames.has(cat.name)
        const subs = existingSubNames[cat.name] || new Set<string>()
        const isExpanded = expanded.has(cat.name)
        const defaultCount = cat.children.filter((c) => c.is_default).length

        return (
          <div key={cat.name} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {/* 大类标题行（与左侧 SortableCategoryRow 同款，去掉手柄与编辑按钮，操作位换成「恢复」） */}
            <div className="flex items-center gap-1 px-4 py-3 pl-2">
              {/* 拖拽手柄占位 */}
              <div className="w-6 flex-shrink-0" />

              {/* 默认大类开关：只读展示（系统默认大类均参与「添加某天」） */}
              <span
                className="w-5 h-5 flex items-center justify-center rounded-md text-xs flex-shrink-0 bg-primary text-white"
                title="系统默认大类均参与「添加某天」自动记账"
              >
                ✓
              </span>

              <button
                onClick={() => toggleExpanded(cat.name)}
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

              {/* 操作位：恢复整个大类 */}
              <button
                onClick={() => onRestoreCategory(cat.name)}
                disabled={catExists}
                className={`flex-shrink-0 px-2.5 h-7 rounded-lg text-xs font-medium transition-colors ${
                  catExists
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
                title={catExists ? '该大类已在「我的分类」中' : '将整个大类（含全部默认小类）恢复到「我的分类」'}
              >
                {catExists ? '已存在' : '＋ 恢复'}
              </button>
            </div>

            {/* 小类列表（与左侧 SortableSubCategoryRow 非编辑态同款，去掉手柄/删除，恢复按钮在行尾） */}
            {isExpanded && (
              <div className="border-t border-slate-50">
                {cat.children.map((child) => {
                  const subExists = subs.has(child.name)
                  const isNonDaily = NON_DAILY_DEFAULT_NAMES.has(child.name)
                  return (
                    <div
                      key={child.name}
                      className="flex items-center gap-2 px-2 pl-2 py-1 text-base border-b border-slate-50 hover:bg-slate-50"
                    >
                      {/* 拖拽手柄占位 */}
                      <div className="w-6 flex-shrink-0" />

                      {/* 默认小类开关：只读展示 */}
                      <span
                        className={`w-4 h-4 flex items-center justify-center rounded text-xs flex-shrink-0 ${
                          child.is_default ? 'bg-primary text-white' : 'bg-slate-200 text-transparent'
                        }`}
                      >
                        {child.is_default ? '✓' : ''}
                      </span>

                      {/* 日常/非日常标记：只读展示（固定宽度，两态一致不跳动） */}
                      <span
                        className={`w-[52px] h-5 flex-shrink-0 flex items-center justify-center rounded-md text-[10px] ${
                          isNonDaily
                            ? 'bg-slate-200 text-slate-500'
                            : 'bg-transparent text-slate-300 border border-dashed border-slate-200'
                        }`}
                      >
                        {isNonDaily ? '非日常' : '日常'}
                      </span>

                      {/* 小类名称 */}
                      <span className="text-sm font-medium text-slate-700 w-[110px] flex-shrink-0 truncate">
                        {child.name}
                      </span>

                      {/* 默认模板摘要（出厂默认值） */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums w-[100px] text-right flex-shrink-0 text-expense">
                            -¥0.00
                          </span>
                          <span className="inline-flex items-center gap-0.5 w-[90px] flex-shrink-0 text-sm text-slate-400 bg-slate-100 px-2 py-1 rounded-full overflow-hidden whitespace-nowrap">
                            {seedPayIcon}
                            {seedPay}
                          </span>
                          <span className="inline-flex items-center gap-1 w-[80px] flex-shrink-0 text-sm px-2 py-1 rounded-full overflow-hidden whitespace-nowrap text-red-500 bg-red-50">
                            💸 支出
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-slate-400 truncate block">-</span>
                          </div>
                        </div>
                      </div>

                      {/* 操作位：恢复小类 */}
                      <button
                        onClick={() => onRestoreSubCategory(cat.name, child.name)}
                        disabled={subExists}
                        className={`flex-shrink-0 px-2 h-7 rounded-lg text-xs font-medium transition-colors ${
                          subExists
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-primary hover:bg-primary/10'
                        }`}
                        title={subExists ? '该小类已在「我的分类」中' : '将该小类恢复到「我的分类」'}
                      >
                        {subExists ? '已有' : '＋ 恢复'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
