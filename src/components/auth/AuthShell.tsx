import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const EASE = [0.23, 1, 0.32, 1] as const

// Container + item variants drive a gentle staggered entrance (emil: 40-80ms steps,
// strong ease-out). framer-motion respects prefers-reduced-motion automatically
// for layout, and the small translate is harmless under reduced motion.
export const authContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}
export const authItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

function Brand({ name }: { name: string }) {
  const i = name.indexOf(' ') !== -1
    ? name.indexOf(' ')
    : name.toLowerCase().startsWith('loom') ? 4 : Math.min(4, Math.ceil(name.length / 2))
  return (
    <>
      <span className="text-primary">{name.slice(0, i)}</span>
      <span className="text-foreground">{name.slice(i)}</span>
    </>
  )
}

/**
 * Shared, animated auth screen scaffold. No logo — the store name is the brand.
 * Clean hierarchy: small eyebrow, large brand name, supporting subtitle.
 */
export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  const { settings } = useStore()
  const name = settings?.name || 'LoomPOS'
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center bg-background relative overflow-hidden px-6 pt-safe pb-safe font-sans">
      <div aria-hidden className="pointer-events-none absolute -top-40 inset-x-0 h-80 bg-gradient-to-b from-primary/[0.07] to-transparent blur-3xl" />
      <motion.div
        variants={authContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] mx-auto relative z-10"
      >
        <motion.header variants={authItem} className="mb-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2">Point of Sale</p>
          <h1 className="text-[2rem] leading-none font-bold tracking-tight"><Brand name={name} /></h1>
          <p className="text-sm text-muted-foreground mt-2.5">{subtitle}</p>
        </motion.header>
        {children}
      </motion.div>
    </div>
  )
}

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: ReactNode
  trailing?: ReactNode
  error?: boolean
}

/** Animated, focus-reactive input row used by both auth screens. */
export function AuthField({ label, icon, trailing, error, className, ...props }: AuthFieldProps) {
  return (
    <motion.div variants={authItem} className="space-y-1.5 group">
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-focus-within:text-primary transition-colors">
        {label}
      </label>
      <div className="relative">
        <span className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors',
          error ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary')}>
          {icon}
        </span>
        <Input
          {...props}
          className={cn(
            'h-12 pl-10 rounded-xl bg-accent/10 text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/25 focus:border-primary',
            trailing ? 'pr-11' : 'pr-3',
            error && 'border-destructive focus:ring-destructive/25 animate-shake',
            className,
          )}
        />
        {trailing && <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </motion.div>
  )
}
