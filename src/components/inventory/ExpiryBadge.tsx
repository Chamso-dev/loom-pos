import { CalendarClock } from 'lucide-react'
import { useI18n } from '@/i18n'
import { expiryStatus } from '@/lib/domain'
import { cn } from '@/lib/utils'

/** A calendar day as a local date, so it never shifts to the day before in the shop's timezone. */
export const dayAsDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Where a product stands against its expiry date: red once expired, amber on the last day and
 * within EXPIRY_SOON_DAYS, and a plain "good until" otherwise. Renders nothing when the product
 * has no expiry date, or when it is still good and `onlyWarnings` is set.
 */
export default function ExpiryBadge({
  value,
  onlyWarnings = false,
  className,
}: {
  value?: string | null
  onlyWarnings?: boolean
  className?: string
}) {
  const i18n = useI18n()
  const { t } = i18n
  const status = expiryStatus(value)
  if (!status || (onlyWarnings && status.state === 'ok')) return null

  if (status.state === 'ok') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <CalendarClock size={12} className="shrink-0" aria-hidden="true" />
        {t('inventory.expiry.goodUntil', { date: i18n.date(dayAsDate(status.day)) })}
      </span>
    )
  }

  const expired = status.state === 'expired'
  const label = expired
    ? t('inventory.expiry.expired', { count: -status.days })
    : status.state === 'today'
      ? t('inventory.expiry.today')
      : t('inventory.expiry.soon', { count: status.days })

  return (
    <span
      title={i18n.date(dayAsDate(status.day))}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        expired ? 'border-loss/30 bg-loss/10 text-loss' : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
        className
      )}
    >
      <CalendarClock size={12} className="shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}
