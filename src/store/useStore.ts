import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  employeeId: string
  name: string
  role: 'ADMIN' | 'CASHIER'
  phone?: string | null
  isActive: boolean
  createdAt: string
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
  login: (employeeId: string, password: string) => Promise<{ success: boolean, error?: string }>
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

  // Users State (Admin)
  users: User[]
  fetchUsers: () => Promise<void>
  addUser: (userData: any) => Promise<void>
  updateUser: (id: string, userData: any) => Promise<void>
  revealStaffPassword: (staffId: string, adminPassword: string) => Promise<{ success: boolean, password?: string, error?: string }>
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
      login: async (employeeId, password) => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, password }),
          })
          if (!response.ok) {
            const data = await response.json()
            return { success: false, error: data.error || 'Login failed' }
          }
          const user = await response.json()
          set({ user })
          return { success: true }
        } catch (error) {
          return { success: false, error: 'Connection error' }
        }
      },
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

      // Users (Admin)
      users: [],
      fetchUsers: async () => {
        try {
          const response = await fetch('/api/users')
          if (!response.ok) throw new Error('Failed to fetch users')
          const users = await response.json()
          set({ users })
        } catch (error) {
          console.error('Failed to fetch users:', error)
        }
      },
      addUser: async (userData) => {
        try {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          })
          if (!response.ok) throw new Error('Failed to add user')
          const newUser = await response.json()
          set((state) => ({ users: [newUser, ...state.users] }))
        } catch (error) {
          console.error('Failed to add user:', error)
        }
      },
      updateUser: async (id, userData) => {
        try {
          const response = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          })
          if (!response.ok) throw new Error('Failed to update user')
          const updatedUser = await response.json()
          set((state) => ({
            users: state.users.map((u) => (u.id === id ? updatedUser : u)),
          }))
        } catch (error) {
          console.error('Failed to update user:', error)
        }
      },
      revealStaffPassword: async (staffId, adminPassword) => {
        const adminUser = get().user;
        if (!adminUser || adminUser.role !== 'ADMIN') {
          return { success: false, error: 'Unauthorized: Admin access required' };
        }

        try {
          const response = await fetch(`/api/users/${staffId}/reveal-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              adminEmployeeId: adminUser.employeeId, 
              adminPassword 
            }),
          });
          
          if (!response.ok) {
            const data = await response.json();
            return { success: false, error: data.error || 'Verification failed' };
          }
          
          const { password } = await response.json();
          return { success: true, password };
        } catch (error) {
          return { success: false, error: 'Connection failure' };
        }
      },
      changePassword: async (employeeId, currentPassword, newPassword) => {
        try {
          const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, currentPassword, newPassword }),
          })
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to change password')
          }
          return { success: true }
        } catch (error: any) {
          console.error('Change password error:', error)
          return { success: false, error: error.message }
        }
      },

    }),



    {
      name: 'loom-pos-storage',
      partialize: (state) => ({ user: state.user, cart: state.cart, theme: state.theme }),
    }
  )
)
