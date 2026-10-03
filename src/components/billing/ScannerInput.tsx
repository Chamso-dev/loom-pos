import { useState, useRef, useEffect } from 'react'
import { ScanBarcode } from 'lucide-react'
import { useStore, type Product } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function ScannerInput() {
  const [value, setValue] = useState('')
  const [isError, setIsError] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { addByBarcode, products, addToCart } = useStore()
  const { t, unitPrice, qty } = useI18n()

  const query = value.trim().toLowerCase()
  const filteredProducts = query
    ? products.filter((p) => p.name.toLowerCase().includes(query) || p.barcode.toLowerCase().includes(query))
    : []

  useEffect(() => setActiveIndex(-1), [value])

  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const row = dropdownRef.current.children[activeIndex] as HTMLElement | undefined
      row?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Keep the scanner field focused unless the cashier is typing somewhere else.
  useEffect(() => {
    const focus = () => {
      const el = document.activeElement
      if (!el || el === document.body) inputRef.current?.focus()
    }
    focus()
    const interval = setInterval(focus, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const done = () => {
    setValue('')
    setIsError(false)
    setShowDropdown(false)
  }

  const select = (product: Product) => {
    if (product.stock <= 0) {
      setIsError(true)
      return
    }
    addToCart(product)
    done()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (activeIndex >= 0 && filteredProducts[activeIndex]) return select(filteredProducts[activeIndex])
    const term = value.trim()
    if (!term) return
    const exact = products.find((p) => p.barcode === term)
    if (exact) return select(exact)
    if (await addByBarcode(term)) return done()
    if (filteredProducts.length > 0) return select(filteredProducts[0])
    setIsError(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredProducts.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredProducts.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative font-sans">
      <form onSubmit={handleSubmit} className="relative">
        <ScanBarcode
          size={18}
          className={cn('absolute start-3.5 top-1/2 -translate-y-1/2', isError ? 'text-destructive' : 'text-muted-foreground')}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setIsError(false)
            setShowDropdown(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={t('billing.scanPlaceholder')}
          aria-label={t('billing.scanPlaceholder')}
          role="combobox"
          aria-expanded={showDropdown && filteredProducts.length > 0}
          className={cn(
            'w-full h-12 ps-11 pe-28 rounded-md border bg-card text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring/40',
            isError ? 'border-destructive bg-destructive/5 animate-shake' : 'border-border focus:border-primary'
          )}
        />
        <span
          className={cn(
            'absolute end-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-semibold border',
            isError ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground border-border'
          )}
        >
          {isError ? t('billing.scanNotFound') : t('billing.scanReady')}
        </span>
      </form>

      {showDropdown && filteredProducts.length > 0 && (
        <div ref={dropdownRef} role="listbox" className="absolute top-14 inset-x-0 bg-card border border-border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto custom-scrollbar">
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => select(product)}
              className={cn(
                'w-full flex items-center justify-between gap-4 px-4 py-2.5 text-start border-b border-border/40 last:border-0',
                index === activeIndex ? 'bg-accent' : 'hover:bg-accent/50',
                product.stock <= 0 && 'opacity-55'
              )}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-sm truncate"><bdi>{product.name}</bdi></span>
                {product.size && <span className="block text-xs text-muted-foreground"><bdi>{product.size}</bdi></span>}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {product.stock > 0 ? t('billing.inStock', { stock: qty(product.stock, product.unit, true) }) : t('billing.outOfStock')}
                </span>
                <span className="font-semibold text-sm text-link">{unitPrice(product.sellingPrice, product.unit)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
