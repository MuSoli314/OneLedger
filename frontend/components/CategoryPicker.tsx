import { useState, useRef, useEffect } from 'react'
import { useCategories } from '../contexts/CategoryContext'

interface Props {
  value: { l1: string; l2: string }
  onChange: (value: { l1: string; l2: string }) => void
}

export default function CategoryPicker({ value, onChange }: Props) {
  const { categories } = useCategories()
  const [showL1, setShowL1] = useState(false)
  const [showL2, setShowL2] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 点击组件外部时收起下拉
  useEffect(() => {
    if (!showL1 && !showL2) return
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setShowL1(false)
        setShowL2(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showL1, showL2])

  const selectedCategory = categories.find((c) => c.name === value.l1)
  const isL2Valid = selectedCategory?.children.some((c) => c.name === value.l2)

  return (
    <div className="flex gap-2" ref={rootRef}>
      {/* 一级分类 */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => { setShowL1(!showL1); setShowL2(false) }}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base text-left hover:border-primary/50 transition-colors"
        >
          <span>{selectedCategory?.icon || '📂'}</span>
          <span className={value.l1 ? 'text-slate-900' : 'text-slate-400'}>
            {value.l1 || '选择大类'}
          </span>
          <svg className="ml-auto w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showL1 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  onChange({ l1: cat.name, l2: '' })
                  setShowL1(false)
                  setShowL2(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-base hover:bg-slate-50 transition-colors ${
                  cat.name === value.l1 ? 'bg-primary/5 text-primary font-medium' : 'text-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                {cat.name === value.l1 && (
                  <svg className="ml-auto w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 二级分类 */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => { if (selectedCategory) { setShowL2(!showL2); setShowL1(false) } }}
          disabled={!selectedCategory}
          className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-base text-left transition-colors ${
            selectedCategory
              ? 'bg-white hover:border-primary/50 cursor-pointer'
              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
          }`}
        >
          <span className={isL2Valid ? 'text-slate-900' : 'text-slate-400'}>
            {isL2Valid ? value.l2 : '选择小类'}
          </span>
          <svg className="ml-auto inline w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showL2 && selectedCategory && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {selectedCategory.children.map((child) => (
              <button
                key={child.name}
                type="button"
                onClick={() => {
                  onChange({ l1: value.l1, l2: child.name })
                  setShowL2(false)
                }}
                className={`w-full px-3 py-2.5 text-base hover:bg-slate-50 transition-colors text-left ${
                  child.name === value.l2 ? 'bg-primary/5 text-primary font-medium' : 'text-slate-700'
                }`}
              >
                {child.name}
                {child.name === value.l2 && (
                  <svg className="ml-auto inline w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
