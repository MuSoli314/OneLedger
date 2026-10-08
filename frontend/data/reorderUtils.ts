// 拖拽排序的共用工具：把「按 id 列表重排数组」的逻辑抽出来，
// 供 CategoryContext / SettingsContext 的乐观更新使用（纯函数，不依赖 React）。
// 全 App 的拖拽排序统一走这里，避免各处各写一份。

/**
 * 按 orderedIds 重排数组（返回新数组）。
 * - 找不到对应 id，或重排后数量对不上（并发增删等异常）：原样返回，交给落库结果兜底
 * - 顺序没变化：返回原数组引用，让 React 跳过这次重渲染
 */
export function applyOrder<T extends { id: number }>(prev: T[], orderedIds: number[]): T[] {
  const byId = new Map(prev.map((item) => [item.id, item]))
  const next: T[] = []
  for (const id of orderedIds) {
    const item = byId.get(id)
    if (item) next.push(item)
  }
  if (next.length !== prev.length) return prev
  if (next.every((item, i) => item === prev[i])) return prev
  return next
}
