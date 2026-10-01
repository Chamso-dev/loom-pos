import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Download, Printer, X } from 'lucide-react'
import { rupees } from './dayMath'

interface EODProps {
  summary: {
    revenue: number
    orders: number
    gst: number
    paymentBreakdown: Array<{ paymentMethod: string; _sum: { totalAmount: number | null } }>
  } | null
  onClose: () => void
}

const METHODS = [
  { method: 'CASH', label: 'Cash', dip: 'ld-dip-cash' },
  { method: 'UPI', label: 'UPI', dip: 'ld-dip-upi' },
  { method: 'CARD', label: 'Card', dip: 'ld-dip-card' },
]

export default function EndOfDaySummary({ summary, onClose }: EODProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const revenue = summary?.revenue || 0
  const amountFor = (method: string) =>
    summary?.paymentBreakdown?.find((p) => p.paymentMethod === method)?._sum?.totalAmount ?? 0
  const cash = amountFor('CASH')

  return (
    <div className="ld-overlay" onClick={onClose}>
      <div
        className="ld-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ld-eod-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ld-dialog-head">
          <div>
            <h2 id="ld-eod-title" className="ld-dialog-title">Close the day</h2>
            <p className="ld-date">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>
          <button ref={closeRef} className="ld-icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="ld-dialog-total">{rupees(revenue)}</p>
        <p className="ld-empty">
          from {summary?.orders || 0} {summary?.orders === 1 ? 'bill' : 'bills'}, including {rupees(summary?.gst || 0)} GST
        </p>

        <ul className="ld-list ld-dialog-list">
          {METHODS.map((m) => (
            <li key={m.method} className="ld-list-row">
              <span className="ld-item-name">
                <span className={`ld-dip ${m.dip}`} />
                {m.label}
              </span>
              <span className="ld-item-value">{rupees(amountFor(m.method))}</span>
            </li>
          ))}
        </ul>

        <p className="ld-dialog-note">
          Count the cash drawer. It should hold <strong>{rupees(cash)}</strong> from today's sales, plus any opening float.
        </p>

        <div className="ld-dialog-actions">
          <button className="ld-button ld-button-quiet">
            <Download size={16} /> Export
          </button>
          <button className="ld-button">
            <Printer size={16} /> Print report
          </button>
        </div>
      </div>
    </div>
  )
}
