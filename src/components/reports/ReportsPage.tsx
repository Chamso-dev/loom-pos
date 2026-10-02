import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '@/components/ui/field'
import { useI18n, type TKey } from '@/i18n'
import { api } from '@/lib/api'
import { localDate } from '../dashboard/dayMath'
import { cn } from '@/lib/utils'

interface Row {
  period: string
  orders: number
  gross: number
  discounts: number
  sales: number
  refunds: number
  net: number
  tax: number
  cost: number
  profit: number
  creditGiven: number
  purchases: number
}

interface Report {
  rows: Row[]
  totals: Row
  moneyIn: Array<{ method: string; amount: number }>
  refundsOut: Array<{ method: string; amount: number }>
  supplierPayments: Array<{ method: string; amount: number }>
  repayments: number
  cash: { in: number; refunded: number; toSuppliers: number; expected: number }
  outstanding: { customers: number; suppliers: number }
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
type Preset = 'today' | 'thisMonth' | 'lastMonth' | 'custom'

export default function ReportsPage() {
  const i18n = useI18n()
  const { t, money } = i18n
  const today = new Date()
  const [preset, setPreset] = useState<Preset>('thisMonth')
  const [from, setFrom] = useState(ymd(startOfMonth(today)))
  const [to, setTo] = useState(ymd(today))
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await api<Report>('/reports', { query: { from, to, groupBy } }))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [from, to, groupBy])

  useEffect(() => {
    load()
  }, [load])

  const choose = (p: Preset) => {
    setPreset(p)
    const now = new Date()
    if (p === 'today') {
      setFrom(ymd(now))
      setTo(ymd(now))
      setGroupBy('day')
    } else if (p === 'thisMonth') {
      setFrom(ymd(startOfMonth(now)))
      setTo(ymd(now))
    } else if (p === 'lastMonth') {
      const last = subMonths(now, 1)
      setFrom(ymd(startOfMonth(last)))
      setTo(ymd(endOfMonth(last)))
    }
  }

  const periodLabel = (period: string) =>
    groupBy === 'month' ? i18n.date(localDate(`${period}-01`), 'month') : i18n.date(localDate(period), 'medium')

  /** CSV with plain numbers (dot decimals) so spreadsheets read them as numbers. */
  const exportCsv = () => {
    if (!report) return
    const cols: Array<[keyof Row, TKey]> = [
      ['orders', 'reports.orders'],
      ['sales', 'reports.sales'],
      ['discounts', 'reports.discounts'],
      ['refunds', 'reports.refunds'],
      ['net', 'reports.netSales'],
      ['tax', 'reports.tax'],
      ['cost', 'reports.cost'],
      ['profit', 'reports.profit'],
      ['creditGiven', 'reports.creditGiven'],
      ['purchases', 'reports.purchases'],
    ]
    const header = [t('reports.periodCol'), ...cols.map(([, k]) => `${t(k)} (DZD)`)]
    const rows = [...report.rows, { ...report.totals, period: t('reports.totalRow') }].map((r) => [r.period, ...cols.map(([k]) => String(r[k]))])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `loompos-report-${from}-${to}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const totals = report?.totals

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center border border-border"><BarChart3 size={20} /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('reports.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('reports.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!report || report.rows.length === 0}>
          <Download size={15} /> {t('reports.export')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{t('reports.period')}</span>
          <div className="flex flex-wrap gap-1.5" role="group">
            {(['today', 'thisMonth', 'lastMonth', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={preset === p}
                onClick={() => choose(p)}
                className={cn('px-3 py-1.5 rounded-md border text-sm font-medium', preset === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}
              >
                {p === 'today' ? t('common.today') : p === 'thisMonth' ? t('common.thisMonth') : p === 'lastMonth' ? t('common.lastMonth') : t('reports.custom')}
              </button>
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <div className="flex gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t('common.from')}</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>{t('common.to')}</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground" />
            </label>
          </div>
        )}
        <div className="space-y-1.5 ms-auto">
          <span className="text-xs font-semibold text-muted-foreground">{t('reports.groupBy')}</span>
          <div className="flex gap-1.5" role="group">
            {(['day', 'month'] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={groupBy === g}
                onClick={() => setGroupBy(g)}
                className={cn('px-3 py-1.5 rounded-md border text-sm font-medium', groupBy === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent')}
              >
                {g === 'day' ? t('reports.byDay') : t('reports.byMonth')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
      {loading && !report && <p className="text-muted-foreground">{t('reports.loading')}</p>}

      {report && totals && (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">{t('reports.netSales')}</p>
                  <p className="text-3xl font-bold tabular-nums">{money(totals.net)}</p>
                  <p className="text-xs text-muted-foreground">{t('reports.netSalesHint')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('reports.profit')}</p>
                  <p className={cn('text-3xl font-bold tabular-nums', totals.profit < 0 && 'text-destructive')}>{money(totals.profit)}</p>
                  <p className="text-xs text-muted-foreground">{t('reports.profitHint')}</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                {(
                  [
                    ['reports.tax', totals.tax],
                    ['reports.refunds', totals.refunds],
                    ['reports.discounts', totals.discounts],
                    ['reports.creditGiven', totals.creditGiven],
                    ['reports.repayments', report.repayments],
                    ['reports.purchases', totals.purchases],
                  ] as Array<[TKey, number]>
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border/60 py-1.5">
                    <dt className="text-muted-foreground">{t(k)}</dt>
                    <dd className="tabular-nums font-medium">{money(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-lg border border-border bg-card p-5 space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.expectedCash')}</p>
                <p className="text-3xl font-bold tabular-nums">{money(report.cash.expected)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.expectedCashHint')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t('reports.outstandingNow')}</p>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between"><dt>{t('reports.customersOwe')}</dt><dd className="tabular-nums font-semibold text-amber-800 dark:text-amber-300">{money(report.outstanding.customers)}</dd></div>
                  <div className="flex justify-between"><dt>{t('reports.shopOwes')}</dt><dd className="tabular-nums font-semibold">{money(report.outstanding.suppliers)}</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {(
              [
                ['reports.moneyIn', report.moneyIn],
                ['reports.refundsOut', report.refundsOut],
                ['reports.supplierPayments', report.supplierPayments],
              ] as Array<[TKey, Array<{ method: string; amount: number }>]>
            ).map(([title, list]) => (
              <div key={title} className="rounded-lg border border-border bg-card p-4">
                <h2 className="font-semibold mb-3">{t(title)}</h2>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('reports.nothing')}</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {list.map((m) => (
                      <li key={m.method} className="flex justify-between">
                        <span>{i18n.method(m.method)}</span>
                        <span className="tabular-nums font-medium">{money(m.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border bg-card overflow-x-auto">
            <h2 className="font-semibold p-4 pb-0">{t('reports.breakdown')}</h2>
            {report.rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t('reports.empty')}</p>
            ) : (
              <table className="w-full text-sm mt-3">
                <thead className="text-xs text-muted-foreground border-y border-border bg-secondary/40">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('reports.periodCol')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.orders')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.sales')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.refunds')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.netSales')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.tax')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.cost')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('reports.profit')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[...report.rows, { ...totals, period: '' }].map((r, i, all) => {
                    const isTotal = i === all.length - 1
                    return (
                      <tr key={r.period || 'total'} className={cn(isTotal && 'font-semibold bg-secondary/30')}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{isTotal ? t('reports.totalRow') : periodLabel(r.period)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{i18n.number(r.orders)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{money(r.sales)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{r.refunds ? money(r.refunds) : '–'}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{money(r.net)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{money(r.tax)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{money(r.cost)}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{money(r.profit)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
