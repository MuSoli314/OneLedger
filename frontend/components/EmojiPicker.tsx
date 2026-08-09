import { useEffect, useRef, useState } from 'react'
import { EMOJI_LIST } from '../data/emojis'

/** emoji 网格 + 自定义输入（不含定位外壳，由调用方决定弹窗或内嵌展示） */
export function EmojiPickerGrid({ current, onPick }: { current: string; onPick: (e: string) => void }) {
  const [custom, setCustom] = useState('')
  const confirmCustom = () => {
    const v = custom.trim()
    if (v) onPick(v)
  }
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,2rem)] gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-slate-100 transition-colors ${
              current === emoji ? 'bg-primary/10 ring-1 ring-primary' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      {/* 自定义 emoji 输入 */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmCustom() }}
          placeholder="粘贴自定义图标"
          maxLength={8}
          className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary text-slate-700"
        />
        <button
          onClick={confirmCustom}
          disabled={!custom.trim()}
          className="flex-shrink-0 text-xs px-2.5 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          使用
        </button>
      </div>
    </>
  )
}

/** 绝对定位的 emoji 弹窗（撑满父级宽度，点击外部自动关闭由外层容器处理） */
export function EmojiGrid({ current, onPick }: { current: string; onPick: (e: string) => void }) {
  return (
    <div className="absolute z-40 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
      <EmojiPickerGrid current={current} onPick={onPick} />
    </div>
  )
}

/** 图标按钮 + 弹窗（点击外部自动关闭） */
export function IconPickerButton({ icon, open, onToggle, onPick, onClose }: {
  icon: string
  open: boolean
  onToggle: () => void
  onPick: (e: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // 点击弹窗外部任意区域时自动关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <div className="flex-shrink-0" ref={ref}>
      <button
        onClick={onToggle}
        className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-lg text-xl hover:bg-slate-200 transition-colors"
        title="修改图标"
      >
        {icon}
      </button>
      {open && <EmojiGrid current={icon} onPick={onPick} />}
    </div>
  )
}
