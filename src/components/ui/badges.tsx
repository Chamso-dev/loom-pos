import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { PaymentIcon } from '../billing/PaymentModal'

const statusStyle: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  CREDIT: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  PARTIALLY_REFUNDED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  REFUNDED: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', statusStyle[status] ?? statusStyle.PAID)}>
      {t(`payments.status.${(status in statusStyle ? status : 'PAID') as 'PAID'}`)}
    </span>
  )
}

/** The distinct methods used on a sale, with icons. */
export function MethodList({ methods }: { methods: string[] }) {
  const { method } = useI18n()
  const unique = [...new Set(methods)]
  return (
    <span className="flex flex-wrap gap-1.5">
      {unique.map((m) => (
        <span key={m} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium whitespace-nowrap">
          <PaymentIcon method={m} size={12} className="text-muted-foreground" />
          {method(m)}
        </span>
      ))}
    </span>
  )
}
