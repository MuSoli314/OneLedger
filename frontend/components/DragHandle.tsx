// 拖拽排序手柄（六点 grip）——分类管理 / 设置页共用的统一样式
//
// touch-manipulation：触摸拖拽的必备项（官方文档推荐）。触摸事件不像指针事件那样受限，
//   dnd-kit 能在 touchmove 里 preventDefault 阻止页面滚动，前提是这里不设 touch-action: none。
// select-none：长按 0.25 秒触发拖拽期间，避免选中文字/图标。
// pointer-coarse:手机/平板等触摸设备上把接触面积放大到 36×44，桌面（鼠标）尺寸不变。
export default function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-6 h-7 pointer-coarse:w-9 pointer-coarse:h-11 flex items-center justify-center rounded text-slate-300 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 touch-manipulation select-none"
      title="拖拽排序"
    >
      <svg className="w-3.5 h-3.5 pointer-coarse:w-5 pointer-coarse:h-5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    </button>
  )
}
