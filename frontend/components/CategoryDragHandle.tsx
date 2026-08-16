// 拖拽排序手柄图标（六点 grip）
export default function CategoryDragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-6 h-7 flex items-center justify-center rounded text-slate-300 hover:text-primary hover:bg-primary/10 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
      title="拖拽排序"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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
