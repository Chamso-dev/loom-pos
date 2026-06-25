import * as React from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface NumberFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** String-backed value so the field can be fully cleared (no forced 0). */
  value: string
  onValueChange: (value: string) => void
  decimal?: boolean
}

/**
 * Numeric input that behaves the way cashiers expect: it can be cleared
 * completely, shows a placeholder instead of a forced 0, selects its content on
 * focus, supports decimals, and opens the numeric/decimal mobile keyboard.
 * Validation happens when the form is saved, not while typing.
 */
export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onValueChange, decimal = true, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '')
      if (decimal) {
        const i = v.indexOf('.')
        if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '')
      }
      onValueChange(v)
    }
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={handleChange}
        onFocus={(e) => { e.currentTarget.select(); props.onFocus?.(e) }}
        className={cn(className)}
      />
    )
  },
)
NumberField.displayName = 'NumberField'

/** Parses a string-backed numeric field, returning 0 for empty/invalid. */
export function toNum(value: string): number {
  const n = parseFloat(value)
  return Number.isNaN(n) ? 0 : n
}
