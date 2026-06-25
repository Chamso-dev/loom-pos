import { useState, useRef, useEffect } from 'react'
import { ScanBarcode, Camera } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useStore } from '@/store/useStore'
import { cn, formatCurrency } from '@/lib/utils'
import { isCameraScanSupported, scanBarcode } from '@/native/scanner'

export default function ScannerInput() {
  const [value, setValue] = useState('')
  const [isError, setIsError] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isScanning, setIsScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const cameraScanAvailable = isCameraScanSupported()
  const { addByBarcode, products, addToCart } = useStore()

  // Filter products based on search query
  const query = value.trim().toLowerCase()
  const filteredProducts = query
    ? products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.barcode.toLowerCase().includes(query)
      )
    : []

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(-1)
  }, [value])

  // Scroll active product in dropdown into view automatically
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const activeEl = dropdownRef.current.children[activeIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({
          block: 'nearest',
          behavior: 'auto'
        })
      }
    }
  }, [activeIndex])

  // Auto-focus on mount and every 10 seconds if not typing
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    const interval = setInterval(focus, 10000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) && 
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Resolves a scanned/typed term to a product and adds it to the cart.
  // Returns true when something was added. Shared by the form and the camera.
  const resolveTerm = async (term: string): Promise<boolean> => {
    // 1. Check if there is an exact barcode/SKU match in local cache
    const exactLocalMatch = products.find(p => p.barcode === term || p.sku === term)
    if (exactLocalMatch) {
      addToCart(exactLocalMatch)
      return true
    }

    // 2. Fallback to server search/add by barcode
    if (await addByBarcode(term)) {
      return true
    }

    // 3. Fallback: if dropdown has matching items, select the first one
    if (filteredProducts.length > 0) {
      addToCart(filteredProducts[0])
      return true
    }

    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = value.trim()
    if (!term) return

    if (await resolveTerm(term)) {
      setValue('')
      setIsError(false)
      setShowDropdown(false)
    } else {
      setIsError(true)
    }
  }

  const handleCameraScan = async () => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const result = await scanBarcode()
      if (!result.ok) {
        // A cancelled scan is not an error; surface only real failures.
        if (result.reason && result.reason !== 'cancelled') {
          setValue('')
          setIsError(true)
        }
        return
      }

      const term = result.value!.trim()
      if (await resolveTerm(term)) {
        setValue('')
        setIsError(false)
        setShowDropdown(false)
      } else {
        // Not in catalogue: drop the code into the box so the cashier can act.
        setValue(term)
        setIsError(true)
        setShowDropdown(true)
        inputRef.current?.focus()
      }
    } finally {
      setIsScanning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredProducts.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % filteredProducts.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredProducts.length) {
        e.preventDefault()
        handleSelectProduct(filteredProducts[activeIndex])
      }
    }
  }

  const handleInputChange = (val: string) => {
    setValue(val)
    if (isError) setIsError(false)
    setShowDropdown(true)
  }

  const handleSelectProduct = (product: any) => {
    addToCart(product)
    setValue('')
    setIsError(false)
    setShowDropdown(false)
  }

  return (
    <div className="relative group font-sans">
      <form onSubmit={handleSubmit} className="relative">
        <div className={cn(
          "absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 transition-colors",
          isError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary"
        )}>
          <ScanBarcode size={16} className={cn(!isError && "animate-pulse")} />
        </div>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder="Scan barcode or type SKU / keyword..."
          className={cn(
            "pl-10 h-10 bg-card transition-all rounded-md text-sm font-medium tracking-tight",
            cameraScanAvailable ? "pr-28" : "pr-20",
            isError
              ? "border-destructive bg-destructive/5 animate-shake"
              : "border-border hover:border-primary/40 focus:border-primary/60"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <div className={cn(
            "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border transition-colors",
            isError
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-muted text-muted-foreground border-border"
          )}>
            {isError ? 'Not Found' : 'Ready'}
          </div>
          {cameraScanAvailable && (
            <button
              type="button"
              onClick={handleCameraScan}
              disabled={isScanning}
              aria-label="Scan with camera"
              title="Scan with camera"
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded border transition-all active:scale-95",
                "bg-primary text-primary-foreground border-primary/60 hover:opacity-90",
                isScanning && "opacity-60 animate-pulse"
              )}
            >
              <Camera size={14} />
            </button>
          )}
        </div>
      </form>

      {/* Matching Products Dropdown */}
      {showDropdown && filteredProducts.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute top-11 left-0 right-0 bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar"
        >
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelectProduct(product)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors border-b border-border/10 last:border-0",
                index === activeIndex 
                  ? "bg-accent text-accent-foreground font-medium" 
                  : "hover:bg-accent/50 text-foreground"
              )}
            >
              <div className="flex flex-col min-w-0 pr-4">
                <span className="font-semibold text-xs truncate">{product.name}</span>
                <span className={cn(
                  "text-[10px] mt-0.5 font-mono",
                  index === activeIndex ? "text-accent-foreground/80" : "text-muted-foreground"
                )}>{product.sku}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors",
                  index === activeIndex 
                    ? "bg-accent-foreground/10 text-accent-foreground border-accent-foreground/20" 
                    : "bg-secondary text-foreground border-border"
                )}>
                  Qty: {product.stock}
                </span>
                <span className={cn(
                  "font-semibold text-xs transition-colors",
                  index === activeIndex ? "text-accent-foreground" : "text-primary"
                )}>
                  {formatCurrency(product.sellingPrice)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
