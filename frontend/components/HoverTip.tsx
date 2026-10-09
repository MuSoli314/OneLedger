// 即时悬浮提示气泡
//
// 为什么不用原生 title：桌面版跑在 Tauri 的 WebView 里，原生 title 提示有 1 秒左右的延迟，
// 有时甚至不弹（WebView 对 title 的支持和系统浏览器不一致）。
// 这里用 CSS 自绘气泡（与 PaymentMethodTotals 的悬浮气泡同一做法）：鼠标移入立即出现、移出立即消失。
//
// 用法：把需要提示的元素包起来 —— <HoverTip text="点击锁定" align="right"><button …/></HoverTip>
// 提示为空字符串时原样渲染子元素，不产生额外包裹层。
import type { ReactNode } from 'react'

export default function HoverTip({
  text,
  children,
  align = 'center',
  className = '',
}: {
  /** 提示文字；不传则不做任何包裹 */
  text?: string
  children: ReactNode
  /** center = 气泡在元素正上方居中；right = 气泡右对齐（元素贴近容器右边缘时用，防止气泡被裁掉） */
  align?: 'center' | 'right'
  /** 包裹层附加类名（例如 shrink-0，用于原本是 flex 子项的按钮） */
  className?: string
}) {
  if (!text) return <>{children}</>
  return (
    <span className={`relative inline-flex group/tip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs px-2 py-1 opacity-0 group-hover/tip:opacity-100 transition-opacity z-30 shadow-lg ${
          align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
        }`}
      >
        {text}
      </span>
    </span>
  )
}
