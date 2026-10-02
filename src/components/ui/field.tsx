import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary disabled:opacity-50'

/**
 * Label, control, hint and error. When the child is a single form control it gets
 * an id linked to the label, and the hint or error is announced as its description.
 */
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  const noteId = `${id}-note`
  // Our input components, or a bare input, select or textarea. Layout wrappers keep a plain caption.
  const isControl =
    isValidElement(children) && (typeof children.type !== 'string' || ['input', 'select', 'textarea'].includes(children.type))
  const note = error || hint
  const control = isControl
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': note ? noteId : undefined,
        'aria-invalid': error ? true : undefined,
      })
    : children
  return (
    <div className={cn('space-y-1.5', className)}>
      {isControl ? (
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">{label}</label>
      ) : (
        <span className="block text-sm font-medium text-muted-foreground">{label}</span>
      )}
      {control}
      {note && (
        <span id={noteId} className={cn('block text-xs', error ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {note}
        </span>
      )}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClass, className)} {...props} />
))
TextInput.displayName = 'TextInput'

/**
 * Number entry that accepts "1,5" as well as "1.5" and Arabic digits.
 * It is a text field with a decimal keyboard, because type="number" rejects commas.
 */
export const DecimalInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className, ...props }, ref) => (
  <input ref={ref} type="text" inputMode="decimal" autoComplete="off" dir="ltr" className={cn(inputClass, 'text-end tabular-nums', className)} {...props} />
))
DecimalInput.displayName = 'DecimalInput'

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(inputClass, 'pe-8', className)} {...props} />
))
SelectInput.displayName = 'SelectInput'

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[80px] py-2 resize-y', className)} {...props} />
))
TextArea.displayName = 'TextArea'

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {children}
    </p>
  )
}
