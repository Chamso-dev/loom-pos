import { useState, useRef, useEffect } from 'react'
import { Search, ScanBarcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function ScannerInput() {
  const [value, setValue] = useState('')
  const [isError, setIsError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addByBarcode } = useStore()

  // Auto-focus on mount and every 10 seconds if not typing
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    const interval = setInterval(focus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return

    const success = addByBarcode(value.trim())
    if (success) {
      setValue('')
      setIsError(false)
    } else {
      setIsError(true)
      // Optional: Shiver animation or sound could go here
    }
  }

  const handleInputChange = (val: string) => {
    setValue(val)
    if (isError) setIsError(false)
  }

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className={cn(
        "absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 transition-colors",
        isError ? "text-destructive" : "text-muted-foreground group-focus-within:text-primary"
      )}>
        <ScanBarcode size={20} className={cn(!isError && "animate-pulse")} />
      </div>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Scan barcode or type SKU..."
        className={cn(
          "pl-12 h-14 bg-card/40 transition-all rounded-2xl text-lg font-medium tracking-tight shadow-xl",
          isError 
            ? "border-destructive/60 bg-destructive/5 shadow-destructive/5 animate-shake" 
            : "border-border/60 hover:border-primary/40 focus:border-primary/60 shadow-primary/5"
        )}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <div className={cn(
          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border transition-colors",
          isError 
            ? "bg-destructive/10 text-destructive border-destructive/20" 
            : "bg-muted text-muted-foreground border-border/40"
        )}>
          {isError ? 'Not Found' : 'Ready to Scan'}
        </div>
      </div>
    </form>
  )
}
