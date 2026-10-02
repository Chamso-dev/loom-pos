import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Product } from '@/store/useStore'

export interface OrderHit {
  id: string
  invoiceNo: string
  customerName: string | null
  totalAmount: number
}

export type SearchResult = { type: 'product'; id: string; data: Product } | { type: 'order'; id: string; data: OrderHit }

export function useGlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const [products, orders] = await Promise.all([
          api<{ products: Product[] }>('/products', { query: { search: query, limit: 5 }, signal: controller.signal }),
          api<{ orders: OrderHit[] }>('/orders', { query: { search: query, limit: 5 }, signal: controller.signal }),
        ])
        setResults([
          ...(products.products ?? []).map((p) => ({ type: 'product' as const, id: p.id, data: p })),
          ...(orders.orders ?? []).map((o) => ({ type: 'order' as const, id: o.id, data: o })),
        ])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') console.error('Global search failed', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return { query, setQuery, results, isLoading }
}
