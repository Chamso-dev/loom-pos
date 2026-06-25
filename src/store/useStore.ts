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
  cashierPassword?: string | null
}


export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  productType?: 'UNIT' | 'WEIGHTED'
  size?: string | null
  color?: string | null
  costPrice: number
  sellingPrice: number
  gst: number
  stock: number
  minSellWeight?: number | null
  supplier?: string | null
  expiryDate?: string | null
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  phone?: string | null
  notes?: string | null
  totalOrders?: number
  totalSpent?: number
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  notes?: string | null
  linkedProducts?: number
  createdAt: string
  updatedAt: string
}

export interface CartItem {
  id: string
  productId: string
  name: string
  sku: string
  size?: string | null
  price: number // unit price, or price-per-KG for weighted
  quantity: number // unit count, or weight in KG for weighted
  gst: number
  stock: number // To prevent over-selling
  productType?: 'UNIT' | 'WEIGHTED'
  step?: number // increment: 1 for unit, minimum sell weight for weighted
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

interface AppState {
  // Auth State
  token: string | null
  user: User | null
  login: (employeeId: string, password: string) => Promise<{ success: boolean, error?: string }>
  register: (name: string, pin: string) => Promise<{ success: boolean, error?: string }>
  logout: () => void


  // Cart State
  cart: CartItem[]
  addToCart: (product: Product) => void
  addByBarcode: (barcode: string) => Promise<boolean> // Returns true if found
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
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, adminKey?: string) => Promise<boolean>
  updateProduct: (id: string, product: Partial<Product>, adminKey?: string) => Promise<boolean>
  deleteProduct: (id: string, adminKey?: string) => Promise<boolean>

  // Settings State
  settings: StoreSettings | null
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>

  // Customers State
  customers: Customer[]
  fetchCustomers: () => Promise<void>
  addCustomer: (data: { name: string; phone?: string | null; notes?: string | null }) => Promise<Customer | null>

  // Billing / refunds
  refundOrder: (id: string) => Promise<{ success: boolean; error?: string }>

  // Notification State
  lowStockProducts: Product[]
  fetchLowStockAlerts: () => Promise<void>

  // Users State (Admin)
  users: User[]
  fetchUsers: () => Promise<void>
  addUser: (userData: any) => Promise<void>
  updateUser: (id: string, userData: any) => Promise<void>
  requestResetToken: (staffId: string, adminPassword?: string) => Promise<{ success: boolean, resetToken?: string, token?: string, error?: string }>
  resetStaffPassword: (staffId: string, token: string, newPassword: string) => Promise<{ success: boolean, error?: string }>
  changePassword: (employeeId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean, error?: string }>
}




export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      token: null,
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
          const { user, token } = await response.json()
          set({ user, token })
          return { success: true }
        } catch (error) {
          return { success: false, error: 'Connection error' }
        }
      },
      register: async (name, pin) => {
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, pin }),
          })
          if (!response.ok) {
            const data = await response.json()
            return { success: false, error: data.error || 'Sign up failed' }
          }
          const { user, token } = await response.json()
          set({ user, token })
          return { success: true }
        } catch (error) {
          return { success: false, error: 'Connection error' }
        }
      },
      logout: () => set({ user: null, token: null }),


      // Cart
      cart: [],
      addToCart: (product) => set((state) => {
        const isWeighted = product.productType === 'WEIGHTED'
        const step = isWeighted
          ? (product.minSellWeight && product.minSellWeight > 0 ? product.minSellWeight : 0.25)
          : 1
        const existingItem = state.cart.find((i) => i.productId === product.id)
        if (existingItem) {
          return {
            cart: state.cart.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: Math.min(i.stock, round3(i.quantity + (i.step ?? 1))) }
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
          quantity: isWeighted ? Math.min(product.stock, step) : 1,
          gst: product.gst,
          stock: product.stock,
          productType: isWeighted ? 'WEIGHTED' : 'UNIT',
          step,
        }
        return { cart: [...state.cart, newItem] }
      }),
      addByBarcode: async (barcode) => {
        const product = get().products.find(p => p.barcode === barcode)
        if (product) {
          get().addToCart(product)
          return true
        }
        // Fallback: query API
        try {
          const response = await fetch(`/api/products?search=${encodeURIComponent(barcode)}`)
          if (response.ok) {
            const data = await response.json()
            const found = data.products?.find((p: any) => p.barcode === barcode || p.sku === barcode)
            if (found) {
              get().addToCart(found)
              return true
            }
          }
        } catch (error) {
          console.error('Failed to lookup product by barcode:', error)
        }
        return false
      },
      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter((i) => i.productId !== productId),
      })),
      updateQuantity: (productId, quantity) => set((state) => ({
        cart: state.cart.map((i) => {
          if (i.productId !== productId) return i
          const min = i.step ?? 1
          return { ...i, quantity: round3(Math.min(i.stock, Math.max(min, quantity))) }
        }),
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
      addProduct: async (productData, adminKey) => {
        try {
          const { token } = get()
          const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
          if (adminKey) headers['x-admin-verification-key'] = adminKey

          const response = await fetch('/api/products', {
            method: 'POST',
            headers,
            body: JSON.stringify(productData),
          })
          
          if (!response.ok) return false
          
          const nextProduct = await response.json()
          set((state) => ({ products: [nextProduct, ...state.products] }))
          return true
        } catch (error) {
          console.error('Failed to add product:', error)
          return false
        }
      },
      updateProduct: async (id, productData, adminKey) => {
        try {
          const { token } = get()
          const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
          if (adminKey) headers['x-admin-verification-key'] = adminKey

          const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(productData),
          })

          if (!response.ok) return false

          const updatedProduct = await response.json()
          set((state) => ({
            products: state.products.map((p) => (p.id === id ? updatedProduct : p)),
          }))
          return true
        } catch (error) {
          console.error('Failed to update product:', error)
          return false
        }
      },
      deleteProduct: async (id, adminKey) => {
        try {
          const { token } = get()
          const headers: Record<string, string> = { 
            'Authorization': `Bearer ${token}`
          }
          if (adminKey) headers['x-admin-verification-key'] = adminKey

          const response = await fetch(`/api/products/${id}`, { 
            method: 'DELETE',
            headers
          })
          
          if (!response.ok) return false

          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
          }))
          return true
        } catch (error) {
          console.error('Failed to delete product:', error)
          return false
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
      customers: [],
      fetchCustomers: async () => {
        try {
          const res = await fetch('/api/customers', { headers: { 'Authorization': `Bearer ${get().token}` } })
          if (res.ok) set({ customers: await res.json() })
        } catch (e) {
          console.error('Failed to fetch customers', e)
        }
      },
      addCustomer: async (data) => {
        try {
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` },
            body: JSON.stringify(data),
          })
          if (!res.ok) return null
          const created = await res.json()
          await get().fetchCustomers()
          return created
        } catch (e) {
          console.error('Failed to add customer', e)
          return null
        }
      },

      refundOrder: async (id) => {
        try {
          const res = await fetch(`/api/orders/${id}/refund`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${get().token}` },
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            return { success: false, error: data.error || 'Refund failed' }
          }
          // Refresh products so restocked quantities reflect immediately.
          get().fetchProducts()
          return { success: true }
        } catch (e) {
          return { success: false, error: 'Connection error' }
        }
      },

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
          const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${get().token}` }
          })
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` },
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` },
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
      requestResetToken: async (staffId, adminPassword) => {
        const adminUser = get().user;
        const token = get().token;
        if (!adminUser || adminUser.role !== 'ADMIN' || !token) {
          return { success: false, error: 'Unauthorized: Admin access required' };
        }

        try {
          const response = await fetch(`/api/users/${staffId}/reset-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) {
            const data = await response.json();
            return { success: false, error: data.error || 'Verification failed' };
          }
          
          const { token: resetToken } = await response.json();
          return { success: true, resetToken };
        } catch (error) {
          return { success: false, error: 'Connection failure' };
        }
      },
      resetStaffPassword: async (staffId, resetToken, newPassword) => {
        try {
          const response = await fetch(`/api/users/${staffId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().token}` },
            body: JSON.stringify({ token: resetToken, newPassword })
          });
          
          if (!response.ok) {
            const data = await response.json();
            return { success: false, error: data.error || 'Failed to reset password' };
          }
          
          return { success: true };
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
