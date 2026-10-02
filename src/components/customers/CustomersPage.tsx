import { useCallback, useEffect, useState } from 'react'
import { Contact, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import CustomerForm, { type Customer } from './CustomerForm'
import CustomerAccount from './CustomerAccount'

export default function CustomersPage() {
  const i18n = useI18n()
  const { t, money } = i18n
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [owingCount, setOwingCount] = useState(0)
  const [search, setSearch] = useState('')
  const [owing, setOwing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ customers: Customer[]; totalOwed: number; owingCount: number }>('/customers', { query: { search, owing: owing ? '1' : '', limit: 200 } })
      setCustomers(data.customers)
      setTotalOwed(data.totalOwed)
      setOwingCount(data.owingCount)
    } finally {
      setLoading(false)
    }
  }, [search, owing])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border">
            <Contact size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('customers.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('customers.subtitle')}</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-sm text-muted-foreground">{t('customers.totalOwed')}</p>
          <p className="text-3xl font-bold tabular-nums">{money(totalOwed)}</p>
          <p className="text-xs text-muted-foreground">{t('customers.owingCount', { count: owingCount })}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}
            aria-label={t('customers.searchPlaceholder')}
            className="w-full h-10 ps-9 pe-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={owing} onChange={(e) => setOwing(e.target.checked)} className="h-4 w-4 accent-primary" />
          {t('customers.onlyOwing')}
        </label>
        <Button className="ms-auto gap-1.5" onClick={() => setEditing(null)}>
          <Plus size={16} /> {t('customers.addCustomer')}
        </Button>
      </div>

      <div className="relative bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('customers.name')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('customers.phone')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('customers.balance')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('customers.creditLimit')}</th>
              <th className="px-4 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">{search || owing ? t('customers.noMatch') : t('customers.none')}</td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setOpenId(c.id)}>
                <td className="px-4 py-3 font-semibold"><bdi>{c.name}</bdi></td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ? i18n.phone(c.phone) : '–'}</td>
                <td className={`px-4 py-3 text-end tabular-nums font-semibold ${c.balance > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
                  {c.balance > 0 ? money(c.balance) : t('customers.settled')}
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">{c.creditLimit != null ? money(c.creditLimit) : t('customers.noLimit')}</td>
                <td className="px-4 py-3 text-end">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(c.id) }}>
                    {t('customers.open')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== undefined && (
        <CustomerForm
          customer={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            load()
          }}
        />
      )}
      {openId && editing === undefined && (
        <CustomerAccount customerId={openId} onClose={() => setOpenId(null)} onChanged={load} onEdit={(c) => setEditing(c)} />
      )}
    </div>
  )
}
