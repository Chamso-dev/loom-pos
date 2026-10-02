import { useEffect, useState } from 'react'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'
import type { CustomerRef } from '@/store/useStore'
import { ErrorNote, TextInput } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

interface Props {
  onPick: (customer: CustomerRef) => void
  autoFocus?: boolean
}

/** Search customers by name or phone, or add a new one without leaving the till. */
export default function CustomerPicker({ onPick, autoFocus }: Props) {
  const i18n = useI18n()
  const { t, money, phone } = i18n
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerRef[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api<{ customers: CustomerRef[] }>('/customers', { query: { search: query, limit: 8 }, signal: controller.signal })
        setResults(data.customers)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(e)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const startAdding = () => {
    setAdding(true)
    // Prefill from the search: digits go to phone, words to name.
    if (/\d{4,}/.test(query)) setNewPhone(query)
    else setName(query)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const customer = await api<CustomerRef>('/customers', { method: 'POST', body: { name, phone: newPhone || null } })
      onPick(customer)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (adding) {
    return (
      <div className="space-y-3">
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('billing.newCustomerName')} aria-label={t('billing.newCustomerName')} />
        <TextInput
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder={t('common.phonePlaceholder')}
          aria-label={t('common.phone')}
          dir="ltr"
          inputMode="tel"
          className="text-start"
        />
        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
            {t('common.back')}
          </Button>
          <Button type="button" className="flex-1" disabled={!name.trim() || saving} onClick={save}>
            {saving ? t('common.saving') : t('billing.addCustomer')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <TextInput
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('billing.customerSearch')}
          aria-label={t('billing.customerSearch')}
          className="ps-9"
        />
        {loading && <Loader2 size={14} className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <ul className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-border rounded-md border border-border">
        {results.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-start hover:bg-accent">
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate"><bdi>{c.name}</bdi></span>
                <span className="block text-xs text-muted-foreground">{c.phone ? phone(c.phone) : t('common.noContact')}</span>
              </span>
              {c.balance > 0 && (
                <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400">{t('billing.owes', { amount: money(c.balance) })}</span>
              )}
            </button>
          </li>
        ))}
        {!loading && results.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{t('billing.noMatches')}</li>}
      </ul>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={startAdding}>
        <UserPlus size={15} /> {t('billing.newCustomer')}
      </Button>
    </div>
  )
}
