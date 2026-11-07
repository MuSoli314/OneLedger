import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getCategories,
  addCategory as dbAddCategory,
  deleteCategory as dbDeleteCategory,
  updateCategoryName as dbUpdateCategoryName,
  updateCategoryIcon as dbUpdateCategoryIcon,
  toggleCategoryDefault as dbToggleCategoryDefault,
  addSubCategory as dbAddSubCategory,
  deleteSubCategory as dbDeleteSubCategory,
  toggleSubCategoryDefault as dbToggleSubCategoryDefault,
  updateSubCategoryDefaults as dbUpdateSubCategoryDefaults,
  reorderCategories as dbReorderCategories,
  reorderSubCategories as dbReorderSubCategories,
  updateSubCategoryName as dbUpdateSubCategoryName,
  getAllSubcategoryRules,
  addSubcategoryRule as dbAddSubcategoryRule,
  updateSubcategoryRule as dbUpdateSubcategoryRule,
  deleteSubcategoryRule as dbDeleteSubcategoryRule,
  deleteSubcategoryRules as dbDeleteSubcategoryRules,
  reorderSubcategoryRules as dbReorderSubcategoryRules,
} from '../data/database'
import type { CategoryWithChildren, RuleCondition, SubcategoryRule, TransactionType } from '../data/types'
import { applyOrder } from '../data/reorderUtils'

/** 规则列表按小类 id 分组：界面每行直接取自己的规则，不用每次去库里查 */
export type RulesBySub = Record<number, SubcategoryRule[]>

/** 从数据层内存缓存里读全部规则，整理成「小类 id → 该小类的规则（已按优先级排序）」 */
function loadRulesBySub(): RulesBySub {
  const map: RulesBySub = {}
  // getAllSubcategoryRules 读的是内存缓存（同步），数据层保证同一小类内已按 sort_order 升序
  for (const rule of getAllSubcategoryRules()) {
    const list = map[rule.subcategory_id]
    if (list) list.push(rule)
    else map[rule.subcategory_id] = [rule]
  }
  return map
}

interface CategoryContextValue {
  categories: CategoryWithChildren[]
  loading: boolean
  addCategory: (name: string, icon: string) => Promise<number>
  deleteCategory: (id: number) => Promise<void>
  updateCategoryName: (id: number, name: string) => Promise<void>
  updateCategoryIcon: (id: number, icon: string) => Promise<void>
  toggleCategoryDefault: (id: number, is_default: boolean) => Promise<void>
  addSubCategory: (categoryId: number, name: string) => Promise<number>
  deleteSubCategory: (id: number) => Promise<void>
  updateSubCategoryName: (id: number, name: string) => Promise<void>
  toggleSubCategoryDefault: (id: number, is_default: boolean) => Promise<void>
  updateSubCategoryDefaults: (id: number, defaults: { default_note?: string; default_payment_method?: string; default_amount?: number; default_type?: TransactionType; default_is_non_daily?: boolean }) => Promise<void>
  reorderCategories: (orderedIds: number[]) => Promise<void>
  reorderSubCategories: (orderedIds: number[]) => Promise<void>
  /** 每个小类的条件规则（key = 小类 id，value 已按匹配优先级排好序） */
  rulesBySub: RulesBySub
  /** 新增一条规则（默认「总是」+ ¥0），返回新规则 id */
  addRule: (subId: number, conditions?: RuleCondition[], amount?: number) => Promise<number>
  /** 修改规则（启用勾选 / 条件 / 金额，传哪个改哪个） */
  updateRule: (id: number, patch: { enabled?: boolean; conditions?: RuleCondition[]; amount?: number }) => Promise<void>
  /** 删除一条规则 */
  deleteRule: (id: number) => Promise<void>
  /** 清空某个小类的全部规则（「系统默认」一键恢复用） */
  clearRules: (subId: number) => Promise<void>
  /** 同一小类内重排规则（乐观更新：先改界面再落库） */
  reorderRules: (subId: number, orderedIds: number[]) => Promise<void>
}

const CategoryContext = createContext<CategoryContextValue>(null!)

/** 乐观重排小类：orderedIds 必须是同一个大类下的全部小类 id（applyOrder 见 reorderUtils） */
function applySubOrder(prev: CategoryWithChildren[], orderedIds: number[]): CategoryWithChildren[] {
  if (orderedIds.length === 0) return prev
  const target = prev.find((c) => c.children.some((s) => s.id === orderedIds[0]))
  if (!target) return prev
  const nextChildren = applyOrder(target.children, orderedIds)
  if (nextChildren === target.children) return prev
  return prev.map((c) => (c.id === target.id ? { ...c, children: nextChildren } : c))
}

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([])
  const [rulesBySub, setRulesBySub] = useState<RulesBySub>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
      // 规则也一起刷新：删小类 / 勾 ✓（数据库会自动补规则）之后，规则列表必须跟着变
      setRulesBySub(loadRulesBySub())
    } catch (err) {
      console.error('加载分类失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 只刷新规则（改规则、删规则这些操作不需要重新查整棵分类树，省一次往返）
  const refreshRules = useCallback(() => {
    setRulesBySub(loadRulesBySub())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addCategory = useCallback(async (name: string, icon: string): Promise<number> => {
    const newId = await dbAddCategory(name, icon)
    await refresh()
    return newId
  }, [refresh])

  const deleteCategory = useCallback(async (id: number) => {
    await dbDeleteCategory(id)
    await refresh()
  }, [refresh])

  const updateCategoryName = useCallback(async (id: number, name: string) => {
    await dbUpdateCategoryName(id, name)
    await refresh()
  }, [refresh])

  const updateCategoryIcon = useCallback(async (id: number, icon: string) => {
    await dbUpdateCategoryIcon(id, icon)
    await refresh()
  }, [refresh])

  const toggleCategoryDefault = useCallback(async (id: number, is_default: boolean) => {
    await dbToggleCategoryDefault(id, is_default)
    await refresh()
  }, [refresh])

  const addSubCategory = useCallback(async (categoryId: number, name: string): Promise<number> => {
    const newId = await dbAddSubCategory(categoryId, name)
    await refresh()
    return newId
  }, [refresh])

  const deleteSubCategory = useCallback(async (id: number) => {
    await dbDeleteSubCategory(id)
    await refresh()
  }, [refresh])

  const updateSubCategoryName = useCallback(async (id: number, name: string) => {
    await dbUpdateSubCategoryName(id, name)
    await refresh()
  }, [refresh])

  const toggleSubCategoryDefault = useCallback(async (id: number, is_default: boolean) => {
    await dbToggleSubCategoryDefault(id, is_default)
    await refresh()
  }, [refresh])

  const updateSubCategoryDefaults = useCallback(async (id: number, defaults: { default_note?: string; default_payment_method?: string; default_amount?: number; default_type?: TransactionType; default_is_non_daily?: boolean }) => {
    await dbUpdateSubCategoryDefaults(id, defaults)
    await refresh()
  }, [refresh])

  // ===== 拖拽排序 =====
  // ⚠️ 必须是「先改内存、再后台落库」的乐观更新：
  // dnd-kit 的落位动画会在松手那一刻现测被拖卡片的位置作为动画终点，
  // 如果等数据库写完（N 次 UPDATE + 一次全量重查）才 setState，动画就会飞回旧位置（回影）。
  const reorderCategories = useCallback(async (orderedIds: number[]) => {
    setCategories((prev) => applyOrder(prev, orderedIds))
    try {
      await dbReorderCategories(orderedIds)
    } catch (err) {
      console.error('保存分类顺序失败:', err)
      await refresh() // 落库失败才回滚成库里的真实顺序
    }
  }, [refresh])

  const reorderSubCategories = useCallback(async (orderedIds: number[]) => {
    setCategories((prev) => applySubOrder(prev, orderedIds))
    try {
      await dbReorderSubCategories(orderedIds)
    } catch (err) {
      console.error('保存小类顺序失败:', err)
      await refresh()
    }
  }, [refresh])

  // ===== 小类条件规则 =====
  // 所有写操作完成后都从数据层缓存重新读一遍规则，界面才看得到最新的条数/顺序/条件。
  const addRule = useCallback(async (subId: number, conditions: RuleCondition[] = [], amount = 0): Promise<number> => {
    const newId = await dbAddSubcategoryRule(subId, conditions, amount)
    refreshRules()
    return newId
  }, [refreshRules])

  const updateRule = useCallback(async (id: number, patch: { enabled?: boolean; conditions?: RuleCondition[]; amount?: number }) => {
    await dbUpdateSubcategoryRule(id, patch)
    refreshRules()
  }, [refreshRules])

  const deleteRule = useCallback(async (id: number) => {
    await dbDeleteSubcategoryRule(id)
    refreshRules()
  }, [refreshRules])

  const clearRules = useCallback(async (subId: number) => {
    await dbDeleteSubcategoryRules(subId)
    refreshRules()
  }, [refreshRules])

  // 拖规则顺序和拖分类一样：先同步改内存顺序（否则松手动画会飞回旧位置），落库失败才重读回滚
  const reorderRules = useCallback(async (subId: number, orderedIds: number[]) => {
    setRulesBySub((prev) => {
      const current = prev[subId] ?? []
      const next = applyOrder(current, orderedIds)
      if (next === current) return prev
      return { ...prev, [subId]: next }
    })
    try {
      await dbReorderSubcategoryRules(orderedIds)
    } catch (err) {
      console.error('保存规则顺序失败:', err)
      refreshRules()
    }
  }, [refreshRules])

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        addCategory,
        deleteCategory,
        updateCategoryName,
        updateCategoryIcon,
        toggleCategoryDefault,
        addSubCategory,
        deleteSubCategory,
        updateSubCategoryName,
        toggleSubCategoryDefault,
        updateSubCategoryDefaults,
        reorderCategories,
        reorderSubCategories,
        rulesBySub,
        addRule,
        updateRule,
        deleteRule,
        clearRules,
        reorderRules,
      }}
    >
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories(): CategoryContextValue {
  const ctx = useContext(CategoryContext)
  if (!ctx) {
    throw new Error('useCategories must be used within a CategoryProvider')
  }
  return ctx
}
