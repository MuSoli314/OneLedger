// 拖拽排序的统一配置（分类管理 / 设置页共用同一套手感）
//
// 统一约定（改手感只改这里）：
//  1. 不用 <DragOverlay>：让真实的行自己跟着指针移动，拖拽中的行与静止时样式完全一致；
//  2. 拖拽中不改任何外观（不加阴影、不改透明度、不换元素），只提升层级盖住相邻行；
//  3. 只允许上下移动（横向锁死），行不会跟着鼠标左右飘；
//  4. 鼠标与触摸用不同传感器（见 useSortableSensors），手机上滑动页面不会被误判成拖拽。
import type { CSSProperties } from 'react'
import { MouseSensor, TouchSensor, useSensor, useSensors, type Modifier } from '@dnd-kit/core'
import { CSS, type Transform } from '@dnd-kit/utilities'

/** 让位动画时长：dnd-kit 默认 200ms 偏拖沓，150ms 更利落 */
export const SORTABLE_TRANSITION = { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

/** 只允许上下拖动（横向锁死）：否则拖快一点，行会跟着鼠标左右飘 */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * 统一的拖拽传感器：鼠标「移动 5px 即拖」+ 触摸「长按 0.25 秒才拖」。
 *
 * 为什么触摸要长按：手机上没有鼠标按键，手指一碰就进入拖拽的话，
 * 用户想上下滑动页面时会变成拖拽排序，页面滚不动。
 * 长按 0.25 秒才进入拖拽，期间手指移动超过 5px 立即取消 → 滑动页面照常。
 *
 * 为什么不用 PointerSensor：它同时接管鼠标与触摸，无法给两者设不同约束。
 * （官方文档推荐的组合就是 MouseSensor + TouchSensor。）
 * 配套要求：可拖拽元素要设 `touch-action: manipulation`（见 DragHandle.tsx）。
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
}

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
