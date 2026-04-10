import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  role: 'ADMIN' | 'CASHIER'
}

export interface StoreSettings {
  id: string
  name: string
  address: string
  gstin: string
  upiId: string
  phone: string
}


export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  size?: string | null
  color?: string | null
  costPrice: number
  sellingPrice: number
  gst: number
  stock: number
  supplier?: string | null
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  id: string
  productId: string
  name: string
  sku: string
  size?: string | null
  price: number
  quantity: number
  gst: number
  stock: number // To prevent over-selling
}

interface AppState {
  // Sidebar State
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void

  // Auth State
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void

  // Cart State
  cart: CartItem[]
  addToCart: (product: Product) => void
  addByBarcode: (barcode: string) => boolean // Returns true if found
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void

  // Appearance State
  theme: 'dark' | 'light' | 'system'
  setTheme: (theme: 'dark' | 'light' | 'system') => void

  // Inventory State
  products: Product[]
  isLoadingProducts: boolean
  hasMoreProducts: boolean
  totalProducts: number
  fetchProducts: (params?: { page?: number, search?: string }) => Promise<void>
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>

  // Settings State
  settings: StoreSettings | null
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>

  // Notification State
  lowStockProducts: Product[]
  fetchLowStockAlerts: () => Promise<void>
}



export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Sidebar
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

      // Auth
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),

      // Cart
      cart: [],
      addToCart: (product) => set((state) => {
        const existingItem = state.cart.find((i) => i.productId === product.id)
        if (existingItem) {
          return {
            cart: state.cart.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: Math.min(i.stock, i.quantity + 1) }
                : i
            ),
          }
        }
        const newItem: CartItem = {
          id: Math.random().toString(36).substr(2, 9),
          productId: product.id,
          name: product.name,
          sku: product.sku,
          size: product.size,
          price: product.sellingPrice,
          quantity: 1,
          gst: product.gst,
          stock: product.stock
        }
        return { cart: [...state.cart, newItem] }
      }),
      addByBarcode: (barcode) => {
        const product = get().products.find(p => p.barcode === barcode)
        if (product) {
          get().addToCart(product)
          return true
        }
        return false
      },
      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter((i) => i.productId !== productId),
      })),
      updateQuantity: (productId, quantity) => set((state) => ({
        cart: state.cart.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(i.stock, Math.max(1, quantity)) } : i
        ),
      })),
      clearCart: () => set({ cart: [] }),

      // Appearance
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Inventory
      products: [],
      isLoadingProducts: false,
      hasMoreProducts: false,
      totalProducts: 0,
      fetchProducts: async (params = {}) => {
        const { page = 1, search = '' } = params
        set({ isLoadingProducts: true })
        try {
          const query = new URLSearchParams()
          query.set('page', page.toString())
          query.set('limit', '50')
          if (search) query.set('search', search)

          const response = await fetch(`/api/products?${query.toString()}`)
          const data = await response.json()
          
          set((state) => ({ 
            products: page === 1 ? data.products : [...state.products, ...data.products],
            totalProducts: data.total,
            hasMoreProducts: data.hasMore,
            isLoadingProducts: false 
          }))
        } catch (error) {
          console.error('Failed to fetch products:', error)
          set({ isLoadingProducts: false })
        }
      },
      addProduct: async (productData) => {
        try {
          const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
          })
          const nextProduct = await response.json()
          set((state) => ({ products: [nextProduct, ...state.products] }))
        } catch (error) {
          console.error('Failed to add product:', error)
        }
      },
      updateProduct: async (id, productData) => {
        try {
          const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData),
          })
          const updatedProduct = await response.json()
          set((state) => ({
            products: state.products.map((p) => (p.id === id ? updatedProduct : p)),
          }))
        } catch (error) {
          console.error('Failed to update product:', error)
        }
      },
      deleteProduct: async (id) => {
        try {
          await fetch(`/api/products/${id}`, { method: 'DELETE' })
          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
          }))
        } catch (error) {
          console.error('Failed to delete product:', error)
        }
      },

      // Settings
      settings: null,
      fetchSettings: async () => {
        try {
          const response = await fetch('/api/settings')
          if (!response.ok) throw new Error('Failed to fetch settings')
          const settings = await response.json()
          set({ settings })
        } catch (error) {
          console.error('Failed to fetch settings:', error)
        }
      },
      updateSettings: async (settingsData) => {
        try {
          const current = get().settings;
          const payload = { ...current, ...settingsData };
          const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!response.ok) throw new Error('Failed to update settings')
          const updated = await response.json()
          set({ settings: updated })
        } catch (error) {
          console.error('Failed to update settings:', error)
        }
      },

      // Notifications
      lowStockProducts: [],
      fetchLowStockAlerts: async () => {
        try {
          const response = await fetch('/api/inventory/low-stock')
          if (!response.ok) throw new Error('Failed to fetch alerts')
          const products = await response.json()
          set({ lowStockProducts: products })
        } catch (error) {
          console.error('Failed to fetch low stock alerts:', error)
        }
      },
    }),


    {
      name: 'loom-pos-storage',
      partialize: (state) => ({ user: state.user, cart: state.cart, theme: state.theme }),
    }
  )
)
