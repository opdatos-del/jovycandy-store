"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { StoreCart } from "@/lib/medusa/store"

type CommerceContextValue = {
  cart: StoreCart | null
  loading: boolean
  mutating: boolean
  pendingItemId: string | null
  error: string | null
  open: boolean
  itemCount: number
  setOpen: (open: boolean) => void
  refresh: () => Promise<StoreCart | null>
  addItem: (variantId: string, quantity?: number) => Promise<StoreCart>
  updateItem: (itemId: string, quantity: number) => Promise<StoreCart>
  removeItem: (itemId: string) => Promise<StoreCart>
  clearError: () => void
}

const CommerceContext = createContext<CommerceContextValue | null>(null)

type ApiPayload = { cart?: StoreCart | null; message?: string }

async function requestCart(path: string, init?: RequestInit): Promise<StoreCart | null> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as ApiPayload | null
  if (!response.ok) {
    throw new Error(payload?.message ?? "No se pudo completar la operación.")
  }
  return payload?.cart ?? null
}

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoreCart | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const id = requestId.current + 1
    requestId.current = id
    setLoading(true)
    try {
      const next = await requestCart("/api/cart")
      if (requestId.current === id) setCart(next)
      return next
    } catch {
      if (requestId.current === id) setCart(null)
      return null
    } finally {
      if (requestId.current === id) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await requestCart("/api/cart")
        if (!cancelled) setCart(next)
      } catch {
        if (!cancelled) setCart(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mutate = useCallback(
    async (path: string, init: RequestInit) => {
      setMutating(true)
      setError(null)
      try {
        const next = await requestCart(path, init)
        setCart(next)
        return next as StoreCart
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo completar la operación.")
        throw reason
      } finally {
        setMutating(false)
      }
    },
    [],
  )

  const addItem = useCallback(
    (variantId: string, quantity = 1) =>
      mutate("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ variant_id: variantId, quantity }),
      }),
    [mutate],
  )

  const updateItem = useCallback(
    (itemId: string, quantity: number) => {
      setPendingItemId(itemId)
      return mutate(`/api/cart/items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      }).finally(() => setPendingItemId(null))
    },
    [mutate],
  )

  const removeItem = useCallback(
    (itemId: string) => {
      setPendingItemId(itemId)
      return mutate(`/api/cart/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      }).finally(() => setPendingItemId(null))
    },
    [mutate],
  )

  const value = useMemo<CommerceContextValue>(
    () => ({
      cart,
      loading,
      mutating,
      pendingItemId,
      error,
      open,
      itemCount: cart?.itemCount ?? 0,
      setOpen,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearError: () => setError(null),
    }),
    [cart, loading, mutating, pendingItemId, error, open, refresh, addItem, updateItem, removeItem],
  )

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
}

export function useCommerce() {
  const context = useContext(CommerceContext)
  if (!context) throw new Error("useCommerce debe usarse dentro de CommerceProvider")
  return context
}
