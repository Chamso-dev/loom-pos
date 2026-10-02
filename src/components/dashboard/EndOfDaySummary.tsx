import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Printer, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useStore } from '@/store/useStore'

export interface DaySummary {
  revenue: number
  net: number
  tax: number
  orders: number
  discounts: number
  refunds: number
  profit: number
  creditGiven: number
  repayments: number
  payments: Array<{ method: string; amount: number }>
  refundsOut: Array<{ method: string; amount: number }>
  cash: { in: number; refunded: number; toSuppliers: number; expected: number }
  outstanding: { customers: number; suppliers: number }
}

const DIP: Record<string, string> = {
  CASH: 'ld-dip-cash',
  CIB: 'ld-dip-cib',
  EDAHABIA: 'ld-dip-edahabia',
  BARIDIMOB: 'ld-dip-baridimob',
  TRANSFER: 'ld-dip-transfer',
}

/** Day closing: what came in by method, what went out, and the cash to count. */
export default function EndOfDaySummary({ summary, onClose }: { summary: DaySummary; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const i18n = useI18n()
  const { t, money, tx } = i18n
  const storeName = useStore((s) => s.settings?.name)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ld-overlay" onClick={onClose}>
      <style>{`@media print {
        body * { visibility: hidden; }
        .ld-eod-print, .ld-eod-print * { visibility: visible; }
        .ld-eod-print { position: absolute; inset: 0; box-shadow: none !important; max-height: none !important; }
        .ld-eod-actions, .ld-icon-button { display: none !important; }
      }`}</style>
      <div className="ld-dialog ld-eod-print" role="dialog" aria-modal="true" aria-labelledby="ld-eod-title" onClick={(e) => e.stopPropagation()}>
        <div className="ld-dialog-head">
          <div>
            <h2 id="ld-eod-title" className="ld-dialog-title">{t('dashboard.eodTitle')}</h2>
            <p className="ld-date">{storeName ? `${storeName}, ` : ''}{i18n.date(new Date(), 'long')}</p>
          </div>
          <button ref={closeRef} className="ld-icon-button" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <p className="ld-dialog-total">{money(summary.net)}</p>
        <p className="ld-empty">{t('dashboard.eodFrom', { count: summary.orders, tax: money(summary.tax) })}</p>

        <h3 className="ld-dialog-subhead">{t('dashboard.eodMoneyIn')}</h3>
        <ul className="ld-list">
          {summary.payments.length === 0 && <li className="ld-empty">{t('dashboard.noPayments')}</li>}
          {summary.payments.map((p) => (
            <li key={p.method} className="ld-list-row">
              <span className="ld-item-name">
                <span className={`ld-dip ${DIP[p.method] ?? 'ld-dip-transfer'}`} />
                {i18n.method(p.method)}
              </span>
              <span className="ld-item-value">{money(p.amount)}</span>
            </li>
          ))}
        </ul>

        <dl className="ld-list ld-dialog-list">
          {summary.refunds > 0 && (
            <div className="ld-list-row">
              <dt className="ld-item-name">{t('dashboard.eodRefunds')}</dt>
              <dd className="ld-item-value">−{money(summary.refunds)}</dd>
            </div>
          )}
          {summary.creditGiven > 0 && (
            <div className="ld-list-row">
              <dt className="ld-item-name">{t('dashboard.eodCreditGiven')}</dt>
              <dd className="ld-item-value ld-stock-low">{money(summary.creditGiven)}</dd>
            </div>
          )}
          {summary.repayments > 0 && (
            <div className="ld-list-row">
              <dt className="ld-item-name">{t('dashboard.eodRepaid')}</dt>
              <dd className="ld-item-value">{money(summary.repayments)}</dd>
            </div>
          )}
        </dl>

        <p className="ld-dialog-note">{tx('dashboard.eodCash', { amount: <strong>{money(summary.cash.expected)}</strong> })}</p>

        <div className="ld-dialog-actions ld-eod-actions">
          <Link to="/reports" className="ld-button ld-button-quiet" onClick={onClose}>
            <BarChart3 size={16} /> {t('dashboard.eodReports')}
          </Link>
          <button className="ld-button" onClick={() => window.print()}>
            <Printer size={16} /> {t('dashboard.eodPrint')}
          </button>
        </div>
      </div>
    </div>
  )
}
