// 拖拽排序的统一配置（分类管理 / 设置页共用同一套手感）
//
// 统一约定（改手感只改这里）：
//  1. 不用 <DragOverlay>：让真实的行自己跟着指针移动，拖拽中的行与静止时样式完全一致；
//  2. 拖拽中不改任何外观（不加阴影、不改透明度、不换元素），只提升层级盖住相邻行；
//  3. 只允许上下移动（横向锁死），行不会跟着鼠标左右飘。
import type { CSSProperties } from 'react'
import type { Modifier } from '@dnd-kit/core'
import { CSS, type Transform } from '@dnd-kit/utilities'

/** 让位动画时长：dnd-kit 默认 200ms 偏拖沓，150ms 更利落 */
export const SORTABLE_TRANSITION = { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

/** 只允许上下拖动（横向锁死）：否则拖快一点，行会跟着鼠标左右飘 */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * 可排序行的统一样式。
 * zIndex 不可省：被拖的行有 transform，会新建层叠上下文，若不提升层级，
 * DOM 靠后的兄弟行会盖住它（往下拖时会看到被拖的行钻到下面）。
 */
export function sortableRowStyle(
  transform: Transform | null,
  transition: string | undefined,
  isDragging: boolean,
): CSSProperties {
  return {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }
}
