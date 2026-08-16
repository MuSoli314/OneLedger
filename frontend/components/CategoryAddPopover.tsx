// 记账列表「添加」按钮弹出的大类+小类联动选择面板
// （已存在的大类灰色不可选；悬停大类右侧联动显示小类；支持自定义大类/小类）
import type { CategoryWithChildren } from '../data/types'

interface Props {
  categories: CategoryWithChildren[]
  /** 该日期已存在的大类名集合（灰色不可选） */
  existingL1s: Set<string>
  hoverL1: string | null
  customizingL1: string | null
  customizingCategory: boolean
  customName: string
  onHoverL1: (l1: string | null) => void
  onCustomizingL1: (l1: string | null) => void
  onCustomizingCategory: (v: boolean) => void
  onCustomName: (v: string) => void
  /** 点击某大类：批量添加其默认小类（主组件已绑定日期） */
  onAddCategory: (l1: string) => void
  /** 点击某小类：直接添加该小类一条（主组件已绑定日期） */
  onAddSubDirect: (l1: string, l2: string) => void
  /** 自定义大类提交（主组件负责保存并置为悬停） */
  onCustomCategorySubmit: () => void
  /** 自定义小类提交（主组件已绑定日期与悬停大类） */
  onCustomSubmit: (l1: string) => void
}

export default function CategoryAddPopover({
  categories,
  existingL1s,
  hoverL1,
  customizingL1,
  customizingCategory,
  customName,
  onHoverL1,
  onCustomizingL1,
  onCustomizingCategory,
  onCustomName,
  onAddCategory,
  onAddSubDirect,
  onCustomCategorySubmit,
  onCustomSubmit,
}: Props) {
  const getSubCategories = (l1: string): string[] => {
    return categories.find((c) => c.name === l1)?.children.map((c) => c.name) || []
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-30 flex bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* 左列：大类列表 */}
      <div className="w-40 max-h-72 overflow-y-auto py-1">
        {customizingCategory ? (
          <input
            autoFocus
            value={customName}
            onChange={(e) => onCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCustomCategorySubmit()
              if (e.key === 'Escape') { onCustomizingCategory(false); onCustomName('') }
            }}
            onBlur={() => { onCustomizingCategory(false); onCustomName('') }}
            placeholder="输入大类名，回车确认"
            className="w-full h-7 my-0.5 px-2 border border-primary rounded-lg text-sm bg-white focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { onCustomizingCategory(true); onCustomName('') }}
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
              onMouseEnter={() => !disabled && onHoverL1(cat.name)}
              onClick={() => !disabled && onAddCategory(cat.name)}
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
              onChange={(e) => onCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCustomSubmit(hoverL1)
                if (e.key === 'Escape') { onCustomizingL1(null); onCustomName('') }
              }}
              onBlur={() => { onCustomizingL1(null); onCustomName('') }}
              placeholder="输入小类名，回车确认"
              className="w-full h-7 my-0.5 px-2 border border-primary rounded-lg text-sm bg-white focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { onCustomizingL1(hoverL1); onCustomName('') }}
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
                onClick={() => onAddSubDirect(hoverL1, sc)}
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
  )
}
