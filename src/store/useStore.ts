import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, configureApi } from '@/lib/api'
import { newRequestId } from '@/lib/requestId'
import { roundQuantity, unitRule, type Discount, type PaymentMethodCode } from '@/lib/domain'
import type { Lang } from '@/i18n/define'

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
  phone: string
  nif: string
  rc: string
  nis: string
  articleNo: string
  currency: 'DZD'
  language: Lang
  defaultPaymentMethod: PaymentMethodCode
  ripAccount: string
  ribAccount: string
  receiptWidth: 58 | 80
  receiptFooter: string
  receiptShowTax: boolean
  hasCashierPassword: boolean
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  /** piece, kg, g, l, ml or box */
  unit: string
  size?: string | null
  color?: string | null
  costPrice: number
  /** Tax-included price per unit, in DZD. */
  sellingPrice: number
  taxRate: number
  stock: number
  /** Expiry date, YYYY-MM-DD (the server may add a midnight time). Null when it does not expire. */
  expiryDate?: string | null
  supplier?: string | null
  supplierId?: string | null
  createdAt: string
  updatedAt: string
}

/** The SKU is an internal code the server assigns; the app does not ask for it. */
export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'> & { sku?: string }

export interface CartItem {
  id: string
  productId: string
  name: string
  sku: string
  unit: string
  size?: string | null
  price: number
  quantity: number
  taxRate: number
  costPrice: number
  /** Stock when added, to stop overselling. */
  stock: number
  expiryDate?: string | null
}

export interface CustomerRef {
  id: string
  name: string
  phone?: string | null
  balance: number
  creditLimit?: number | null
}

type Result = { ok: true } | { ok: false; error: unknown }

interface AppState {
  // Language
  language: Lang
  /** True once someone picked a language on this device; until then the store default applies. */
  languageChosen: boolean
  setLanguage: (lang: Lang) => void

  // Sidebar: collapsed or expanded on desktop, a slide-in menu on phones
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
  isMobileNavOpen: boolean
  setMobileNavOpen: (isOpen: boolean) => void

  // Auth
  token: string | null
  user: User | null
  login: (employeeId: string, password: string) => Promise<Result>
  logout: () => void

  // Cart
  cart: CartItem[]
  discount: Discount | null
  cartCustomer: CustomerRef | null
  /**
   * Sent with the sale. It stays the same while the cart is unchanged, so pressing
   * "Complete sale" again after a lost connection cannot record the sale twice; any change
   * to the cart, discount or customer starts a new one.
   */
  checkoutRequestId: string
  addToCart: (product: Product, quantity?: number) => void
  addByBarcode: (barcode: string) => Promise<boolean>
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setDiscount: (discount: Discount | null) => void
  setCartCustomer: (customer: CustomerRef | null) => void
  clearCart: () => void

  // Appearance
  theme: 'dark' | 'light' | 'system'
  setTheme: (theme: 'dark' | 'light' | 'system') => void

  // Inventory
  products: Product[]
  isLoadingProducts: boolean
  /** Why the last product list request failed, or null. */
  productsError: unknown
  hasMoreProducts: boolean
  totalProducts: number
  fetchProducts: (params?: { page?: number; search?: string; expiring?: boolean }) => Promise<void>
  addProduct: (product: ProductInput, adminKey?: string) => Promise<Result>
  updateProduct: (id: string, product: Partial<ProductInput>, adminKey?: string) => Promise<Result>
  deleteProduct: (id: string, adminKey?: string) => Promise<Result>

  // Settings
  settings: StoreSettings | null
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<StoreSettings> & { cashierPassword?: string | null }) => Promise<Result>

  // Notifications
  lowStockProducts: Product[]
  /** In-stock products that are expired or expire soon, soonest first. */
  expiringProducts: Product[]
  /** Refreshes both low-stock and expiry alerts. */
  fetchLowStockAlerts: () => Promise<void>

  // Staff (admin)
  users: User[]
  fetchUsers: () => Promise<void>
  addUser: (userData: Record<string, unknown>) => Promise<Result>
  updateUser: (id: string, userData: Record<string, unknown>) => Promise<Result>
  requestResetToken: (staffId: string) => Promise<{ success: boolean; resetToken?: string; error?: unknown }>
  resetStaffPassword: (staffId: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: unknown }>
  changePassword: (employeeId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: unknown }>
}

const attempt = async (fn: () => Promise<unknown>): Promise<Result> => {
  try {
    await fn()
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Language
      language: 'ar',
      languageChosen: false,
      setLanguage: (language) => set({ language, languageChosen: true }),

      // Sidebar
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      isMobileNavOpen: false,
      setMobileNavOpen: (isOpen) => set({ isMobileNavOpen: isOpen }),

      // Auth
      token: null,
      user: null,
      login: async (employeeId, password) =>
        attempt(async () => {
          const { user, token } = await api<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: { employeeId, password },
          })
          set({ user, token })
        }),
      logout: () => set({ user: null, token: null, cartCustomer: null }),

      // Cart
      cart: [],
      discount: null,
      cartCustomer: null,
      checkoutRequestId: newRequestId('sale'),
      addToCart: (product, quantity) =>
        set((state) => {
          // Weighed goods start at 1 kg or 1 L; the cashier then types the scale reading.
          const step = quantity ?? 1
          const existing = state.cart.find((i) => i.productId === product.id)
          if (existing) {
            return {
              checkoutRequestId: newRequestId('sale'),
              cart: state.cart.map((i) =>
                i.productId === product.id
                  ? { ...i, quantity: Math.min(i.stock, roundQuantity(i.quantity + step, i.unit)) }
                  : i
              ),
            }
          }
          if (product.stock <= 0) return {}
          const item: CartItem = {
            id: Math.random().toString(36).slice(2, 11),
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit || 'piece',
            size: product.size,
            price: product.sellingPrice,
            quantity: Math.min(product.stock, roundQuantity(step, product.unit)),
            taxRate: product.taxRate ?? 0,
            costPrice: product.costPrice ?? 0,
            stock: product.stock,
            expiryDate: product.expiryDate ?? null,
          }
          return { cart: [...state.cart, item], checkoutRequestId: newRequestId('sale') }
        }),
      addByBarcode: async (barcode) => {
        const local = get().products.find((p) => p.barcode === barcode || p.sku === barcode)
        if (local) {
          get().addToCart(local)
          return true
        }
        try {
          const data = await api<{ products: Product[] }>('/products', { query: { search: barcode, limit: 5 } })
          const found = data.products?.find((p) => p.barcode === barcode || p.sku === barcode)
          if (found) {
            get().addToCart(found)
            return true
          }
        } catch (error) {
          console.error('Barcode lookup failed', error)
        }
        return false
      },
      removeFromCart: (productId) =>
        set((state) => ({ cart: state.cart.filter((i) => i.productId !== productId), checkoutRequestId: newRequestId('sale') })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          checkoutRequestId: newRequestId('sale'),
          cart: state.cart.map((i) => {
            if (i.productId !== productId) return i
            const smallest = unitRule(i.unit).decimals > 0 ? 10 ** -unitRule(i.unit).decimals : 1
            const next = roundQuantity(Math.min(i.stock, Math.max(smallest, quantity)), i.unit)
            return { ...i, quantity: next }
          }),
        })),
      setDiscount: (discount) => set({ discount, checkoutRequestId: newRequestId('sale') }),
      setCartCustomer: (cartCustomer) => set({ cartCustomer, checkoutRequestId: newRequestId('sale') }),
      clearCart: () => set({ cart: [], discount: null, cartCustomer: null, checkoutRequestId: newRequestId('sale') }),

      // Appearance
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Inventory
      products: [],
      isLoadingProducts: false,
      productsError: null,
      hasMoreProducts: false,
      totalProducts: 0,
      fetchProducts: async (params = {}) => {
        const { page = 1, search = '', expiring = false } = params
        set({ isLoadingProducts: true, productsError: null })
        try {
          const data = await api<{ products: Product[]; total: number; hasMore: boolean }>('/products', {
            query: { page, limit: 50, search, ...(expiring ? { expiring: '1' } : {}) },
          })
          set((state) => ({
            products: page === 1 ? data.products : [...state.products, ...data.products],
            totalProducts: data.total,
            hasMoreProducts: data.hasMore,
          }))
        } catch (error) {
          console.error('Failed to fetch products', error)
          set({ productsError: error })
        } finally {
          set({ isLoadingProducts: false })
        }
      },
      addProduct: (productData, adminKey) =>
        attempt(async () => {
          const product = await api<Product>('/products', { method: 'POST', body: productData, adminKey })
          set((state) => ({ products: [product, ...state.products], totalProducts: state.totalProducts + 1 }))
          get().fetchLowStockAlerts()
        }),
      updateProduct: (id, productData, adminKey) =>
        attempt(async () => {
          const product = await api<Product>(`/products/${id}`, { method: 'PUT', body: productData, adminKey })
          set((state) => ({ products: state.products.map((p) => (p.id === id ? product : p)) }))
          get().fetchLowStockAlerts()
        }),
      deleteProduct: (id, adminKey) =>
        attempt(async () => {
          await api(`/products/${id}`, { method: 'DELETE', adminKey })
          set((state) => ({ products: state.products.filter((p) => p.id !== id), totalProducts: state.totalProducts - 1 }))
        }),

      // Settings
      settings: null,
      fetchSettings: async () => {
        try {
          const settings = await api<StoreSettings>('/settings')
          // A device with no language choice of its own follows the shop's default.
          set((state) => ({ settings, ...(state.languageChosen ? {} : { language: settings.language }) }))
        } catch (error) {
          console.error('Failed to fetch settings', error)
        }
      },
      updateSettings: (data) =>
        attempt(async () => {
          const { hasCashierPassword, id, ...current } = get().settings ?? ({} as StoreSettings)
          const settings = await api<StoreSettings>('/settings', { method: 'PUT', body: { ...current, ...data } })
          set({ settings })
        }),

      // Notifications
      lowStockProducts: [],
      expiringProducts: [],
      fetchLowStockAlerts: async () => {
        try {
          const [lowStockProducts, expiringProducts] = await Promise.all([
            api<Product[]>('/inventory/low-stock'),
            api<Product[]>('/inventory/expiring'),
          ])
          set({ lowStockProducts, expiringProducts })
        } catch (error) {
          console.error('Failed to fetch stock alerts', error)
        }
      },

      // Staff
      users: [],
      fetchUsers: async () => {
        try {
          set({ users: await api<User[]>('/users') })
        } catch (error) {
          console.error('Failed to fetch users', error)
        }
      },
      addUser: (userData) =>
        attempt(async () => {
          const user = await api<User>('/users', { method: 'POST', body: userData })
          set((state) => ({ users: [user, ...state.users] }))
        }),
      updateUser: (id, userData) =>
        attempt(async () => {
          const user = await api<User>(`/users/${id}`, { method: 'PUT', body: userData })
          set((state) => ({ users: state.users.map((u) => (u.id === id ? user : u)) }))
        }),
      requestResetToken: async (staffId) => {
        try {
          const { token } = await api<{ token: string }>(`/users/${staffId}/reset-token`, { method: 'POST' })
          return { success: true, resetToken: token }
        } catch (error) {
          return { success: false, error }
        }
      },
      resetStaffPassword: async (staffId, resetToken, newPassword) => {
        try {
          await api(`/users/${staffId}/reset-password`, { method: 'POST', body: { token: resetToken, newPassword } })
          return { success: true }
        } catch (error) {
          return { success: false, error }
        }
      },
      changePassword: async (employeeId, currentPassword, newPassword) => {
        try {
          await api('/auth/change-password', { method: 'POST', body: { employeeId, currentPassword, newPassword } })
          return { success: true }
        } catch (error) {
          return { success: false, error }
        }
      },
    }),
    {
      name: 'loom-pos-storage',
      version: 2,
      partialize: (state) => ({
        user: state.user,
        cart: state.cart,
        discount: state.discount,
        cartCustomer: state.cartCustomer,
        checkoutRequestId: state.checkoutRequestId,
        theme: state.theme,
        language: state.language,
        languageChosen: state.languageChosen,
        isSidebarOpen: state.isSidebarOpen,
      }),
      // Carts saved by the Indian version had GST and no unit; they are dropped.
      migrate: (persisted: any, version) => {
        if (version < 2 && persisted) return { ...persisted, cart: [], discount: null }
        return persisted
      },
    }
  )
)

configureApi({
  getToken: () => useStore.getState().token,
  onUnauthorized: () => useStore.getState().logout(),
})
