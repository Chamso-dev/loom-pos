import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: 'product' | 'order'
  data: any
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const [productsRes, ordersRes] = await Promise.all([
          fetch(`/api/products?search=${query}&limit=5`),
          fetch(`/api/orders?search=${query}&limit=5`)
        ])

        const productsData = await productsRes.json()
        const ordersData = await ordersRes.json()

        const formattedProducts: SearchResult[] = (productsData.products || []).map((p: any) => ({
          id: p.id,
          title: p.name,
          subtitle: `${p.category} • Stock: ${p.stock}`,
          type: 'product',
          data: p
        }))

        const formattedOrders: SearchResult[] = (ordersData.orders || []).map((o: any) => ({
          id: o.id,
          title: o.invoiceNo,
          subtitle: `${o.customerName || 'Cash'} • ${formatCurrency(o.totalAmount)}`,
          type: 'order',
          data: o
        }))

        setResults([...formattedProducts, ...formattedOrders])
      } catch (error) {
        console.error('Global search error:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  return { query, setQuery, results, isLoading }
}
