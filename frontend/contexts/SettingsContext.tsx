import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  getPaymentMethods,
  addPaymentMethod as dbAddPaymentMethod,
  deletePaymentMethod as dbDeletePaymentMethod,
  updatePaymentMethodName as dbUpdatePaymentMethodName,
  updatePaymentMethodIcon as dbUpdatePaymentMethodIcon,
  reorderPaymentMethods as dbReorderPaymentMethods,
  getTxTypes,
  addTxType as dbAddTxType,
  deleteTxType as dbDeleteTxType,
  updateTxTypeName as dbUpdateTxTypeName,
  updateTxTypeIcon as dbUpdateTxTypeIcon,
  reorderTxTypes as dbReorderTxTypes,
} from '../data/database'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../data/categories'
import type { PaymentMethodConfig, TxTypeConfig, TxCategory } from '../data/types'

interface SettingsContextValue {
  paymentMethods: PaymentMethodConfig[]
  txTypes: TxTypeConfig[]
  loading: boolean
  /** 类别为 expense 的所有 code 集合（统计口径） */
  expenseCodes: Set<string>
  /** 新记录默认类型 code（优先内置 expense，其次第一个计入支出的类型） */
  defaultExpenseCode: string
  addPaymentMethod: (name: string, icon: string) => Promise<void>
  deletePaymentMethod: (id: number) => Promise<void>
  updatePaymentMethodName: (id: number, name: string) => Promise<void>
  updatePaymentMethodIcon: (id: number, icon: string) => Promise<void>
  reorderPaymentMethods: (orderedIds: number[]) => Promise<void>
  addTxType: (name: string, icon: string, category: TxCategory) => Promise<void>
  deleteTxType: (id: number) => Promise<void>
  updateTxTypeName: (id: number, name: string) => Promise<void>
  updateTxTypeIcon: (id: number, icon: string) => Promise<void>
  reorderTxTypes: (orderedIds: number[]) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>(null!)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([])
  const [txTypes, setTxTypes] = useState<TxTypeConfig[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [pm, tt] = await Promise.all([getPaymentMethods(), getTxTypes()])
      setPaymentMethods(pm.length ? pm : PAYMENT_METHODS.map((p, i) => ({ id: i, name: p.name, icon: p.icon })))
      setTxTypes(tt.length ? tt : TRANSACTION_TYPES.map((t, i) => ({ id: i, code: t.value, name: t.name, icon: t.icon, category: t.category })))
    } catch (err) {
      console.error('加载设置失败:', err)
      setPaymentMethods(PAYMENT_METHODS.map((p, i) => ({ id: i, name: p.name, icon: p.icon })))
      setTxTypes(TRANSACTION_TYPES.map((t, i) => ({ id: i, code: t.value, name: t.name, icon: t.icon, category: t.category })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const expenseCodes = useMemo(
    () => new Set(txTypes.filter((t) => t.category === 'expense').map((t) => t.code)),
    [txTypes]
  )

  const defaultExpenseCode = useMemo(() => {
    const builtin = txTypes.find((t) => t.code === 'expense')
    if (builtin) return builtin.code
    const firstExpense = txTypes.find((t) => t.category === 'expense')
    return firstExpense?.code ?? txTypes[0]?.code ?? 'expense'
  }, [txTypes])

  const addPaymentMethod = useCallback(async (name: string, icon: string) => {
    await dbAddPaymentMethod(name, icon)
    await refresh()
  }, [refresh])

  const deletePaymentMethod = useCallback(async (id: number) => {
    await dbDeletePaymentMethod(id)
    await refresh()
  }, [refresh])

  const updatePaymentMethodName = useCallback(async (id: number, name: string) => {
    await dbUpdatePaymentMethodName(id, name)
    await refresh()
  }, [refresh])

  const updatePaymentMethodIcon = useCallback(async (id: number, icon: string) => {
    await dbUpdatePaymentMethodIcon(id, icon)
    await refresh()
  }, [refresh])

  const reorderPaymentMethods = useCallback(async (orderedIds: number[]) => {
    await dbReorderPaymentMethods(orderedIds)
    await refresh()
  }, [refresh])

  const addTxType = useCallback(async (name: string, icon: string, category: TxCategory) => {
    await dbAddTxType(name, icon, category)
    await refresh()
  }, [refresh])

  const deleteTxType = useCallback(async (id: number) => {
    await dbDeleteTxType(id)
    await refresh()
  }, [refresh])

  const updateTxTypeName = useCallback(async (id: number, name: string) => {
    await dbUpdateTxTypeName(id, name)
    await refresh()
  }, [refresh])

  const updateTxTypeIcon = useCallback(async (id: number, icon: string) => {
    await dbUpdateTxTypeIcon(id, icon)
    await refresh()
  }, [refresh])

  const reorderTxTypes = useCallback(async (orderedIds: number[]) => {
    await dbReorderTxTypes(orderedIds)
    await refresh()
  }, [refresh])

  return (
    <SettingsContext.Provider
      value={{
        paymentMethods,
        txTypes,
        loading,
        expenseCodes,
        defaultExpenseCode,
        addPaymentMethod,
        deletePaymentMethod,
        updatePaymentMethodName,
        updatePaymentMethodIcon,
        reorderPaymentMethods,
        addTxType,
        deleteTxType,
        updateTxTypeName,
        updateTxTypeIcon,
        reorderTxTypes,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return ctx
}
