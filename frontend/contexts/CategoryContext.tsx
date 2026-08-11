import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getCategories,
  addCategory as dbAddCategory,
  deleteCategory as dbDeleteCategory,
  updateCategoryName as dbUpdateCategoryName,
  updateCategoryIcon as dbUpdateCategoryIcon,
  addSubCategory as dbAddSubCategory,
  deleteSubCategory as dbDeleteSubCategory,
  toggleSubCategoryDefault as dbToggleSubCategoryDefault,
  updateSubCategoryDefaults as dbUpdateSubCategoryDefaults,
  reorderCategories as dbReorderCategories,
  reorderSubCategories as dbReorderSubCategories,
  updateSubCategoryName as dbUpdateSubCategoryName,
} from '../data/database'
import type { CategoryWithChildren, TransactionType } from '../data/types'

interface CategoryContextValue {
  categories: CategoryWithChildren[]
  loading: boolean
  addCategory: (name: string, icon: string) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  updateCategoryName: (id: number, name: string) => Promise<void>
  updateCategoryIcon: (id: number, icon: string) => Promise<void>
  addSubCategory: (categoryId: number, name: string) => Promise<number>
  deleteSubCategory: (id: number) => Promise<void>
  updateSubCategoryName: (id: number, name: string) => Promise<void>
  toggleSubCategoryDefault: (id: number, isDefault: boolean) => Promise<void>
  updateSubCategoryDefaults: (id: number, defaults: { defaultNote?: string; defaultPaymentMethod?: string; defaultAmount?: number; defaultType?: TransactionType; defaultIsNonDaily?: boolean }) => Promise<void>
  reorderCategories: (orderedIds: number[]) => Promise<void>
  reorderSubCategories: (orderedIds: number[]) => Promise<void>
}

const CategoryContext = createContext<CategoryContextValue>(null!)

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (err) {
      console.error('加载分类失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addCategory = useCallback(async (name: string, icon: string) => {
    await dbAddCategory(name, icon)
    await refresh()
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

  const toggleSubCategoryDefault = useCallback(async (id: number, isDefault: boolean) => {
    await dbToggleSubCategoryDefault(id, isDefault)
    await refresh()
  }, [refresh])

  const updateSubCategoryDefaults = useCallback(async (id: number, defaults: { defaultNote?: string; defaultPaymentMethod?: string; defaultAmount?: number; defaultType?: TransactionType; defaultIsNonDaily?: boolean }) => {
    await dbUpdateSubCategoryDefaults(id, defaults)
    await refresh()
  }, [refresh])

  const reorderCategories = useCallback(async (orderedIds: number[]) => {
    await dbReorderCategories(orderedIds)
    await refresh()
  }, [refresh])

  const reorderSubCategories = useCallback(async (orderedIds: number[]) => {
    await dbReorderSubCategories(orderedIds)
    await refresh()
  }, [refresh])

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        addCategory,
        deleteCategory,
        updateCategoryName,
        updateCategoryIcon,
        addSubCategory,
        deleteSubCategory,
        updateSubCategoryName,
        toggleSubCategoryDefault,
        updateSubCategoryDefaults,
        reorderCategories,
        reorderSubCategories,
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
