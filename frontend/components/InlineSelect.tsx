import { useState, useEffect, useRef, forwardRef } from 'react'
import { createPortal } from 'react-dom'

export interface InlineSelectOption {
  value: string
  label: React.ReactNode
}

/** 阻止原生 mousedown 冒泡，避免触发行级"点击外部自动保存" */
const stopNativeMousedown = (e: React.MouseEvent) => e.stopPropagation()

interface Props {
  value: string
  options: InlineSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  /** 挂载时是否自动展开（用于"点哪个格子就展开哪个下拉"） */
  initialOpen?: boolean
  className?: string
  textColor?: string
}

/**
 * 行内编辑用自绘下拉。
 * 用 React 受控列表替代原生 <select>，解决 WebView 中 showPicker() 无法自动展开的问题：
 * 点击单元格进入编辑 → initialOpen 直接展开选项列表，一次点击即可完成选择。
 * 面板用 portal 渲染到 body，避免被外层 overflow-hidden 裁剪；选项上的原生 mousedown
 * 阻止冒泡，避免触发所在行"点击外部自动保存"的逻辑。
 * ref 转发到底层按钮，供父组件按 focusField 聚焦。
 */
const InlineSelect = forwardRef<HTMLButtonElement, Props>(function InlineSelect(
  { value, options, onChange, placeholder, initialOpen = false, className = '', textColor = 'text-slate-700' },
  btnRef
) {
  const [open, setOpen] = useState(initialOpen)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const localBtnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const optRefs = useRef<(HTMLButtonElement | null)[]>([])

  // 把本地按钮节点同步给外部 ref（供父组件聚焦）
  const setBtnRef = (el: HTMLButtonElement | null) => {
    localBtnRef.current = el
    if (typeof btnRef === 'function') {
      btnRef(el)
    } else if (btnRef) {
      btnRef.current = el
    }
  }

  const selected = options.find((o) => o.value === value)
  // 记录上一次 initialOpen，用于"已编辑中再点该格子时重新展开下拉"
  const wasOpen = useRef(initialOpen)

  const measure = () => {
    const rect = localBtnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  const openMenu = () => {
    measure()
    setOpen(true)
  }

  // initialOpen 从 false→true：重新展开；true→false：收起（切到别的字段时）
  useEffect(() => {
    if (initialOpen && !wasOpen.current) {
      openMenu()
    } else if (!initialOpen && wasOpen.current) {
      setOpen(false)
    }
    wasOpen.current = initialOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpen])

  // 展开时：跟随滚动/缩放重定位；点击面板外关闭
  useEffect(() => {
    if (!open) return
    measure()
    const onScroll = () => measure()
    const onResize = () => measure()
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (localBtnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [open])

  // 聚焦第 i 个选项（支持循环）
  const focusOpt = (i: number) => {
    const n = options.length
    if (n === 0) return
    const idx = ((i % n) + n) % n
    optRefs.current[idx]?.focus()
  }

  const handleBtnKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      if (!open) {
        openMenu()
        // 等面板渲染后再聚焦选项
        requestAnimationFrame(() => focusOpt(dir === 1 ? 0 : options.length - 1))
      } else {
        focusOpt(dir === 1 ? 0 : options.length - 1)
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      localBtnRef.current?.focus()
    }
  }

  const handleOptKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusOpt(i + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusOpt(i - 1) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); localBtnRef.current?.focus() }
  }

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
    localBtnRef.current?.focus()
  }

  const panel = open && pos
    ? createPortal(
        <div
          ref={panelRef}
          onMouseDown={(e) => e.stopPropagation()}
          // 原生事件层面拦截，保证 portal 内点击不会触发行级"点击外部自动保存"
          onMouseDownCapture={stopNativeMousedown}
          className="fixed z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 140) }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">暂无选项</div>
          ) : (
            options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                ref={(el) => { optRefs.current[i] = el }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); select(o.value) }}
                onKeyDown={(e) => handleOptKeyDown(e, i)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-left transition-colors ${
                  o.value === value
                    ? 'bg-primary/5 text-primary font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <svg className="ml-auto w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button
        type="button"
        ref={setBtnRef}
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else openMenu() }}
        onKeyDown={handleBtnKeyDown}
        className={`inline-flex h-8 items-center justify-between gap-1 rounded-lg border bg-white px-2 text-xs transition-colors focus:outline-none focus:border-primary ${
          open ? 'border-primary' : 'border-slate-200'
        } ${selected ? textColor : 'text-slate-400'} ${className}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {panel}
    </>
  )
})

export default InlineSelect
