import { useEffect, useState } from 'react'
import { User, X, Search, Plus, Check, UserPlus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export interface BillingCustomer {
  customerId: string | null
  name: string
  mobile: string
}

interface CustomerPickerProps {
  value: BillingCustomer
  onChange: (v: BillingCustomer) => void
}

export default function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const { customers, fetchCustomers, addCustomer } = useStore()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  )

  const pick = (c: { id: string; name: string; phone?: string | null }) => {
    onChange({ customerId: c.id, name: c.name, mobile: c.phone || '' })
    setOpen(false)
  }

  const pickWalkIn = () => {
    onChange({ customerId: null, name: '', mobile: '' })
    setOpen(false)
  }

  const saveNew = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const created = await addCustomer({ name: newName.trim(), phone: newPhone.trim() || null })
    setSaving(false)
    if (created) {
      pick(created)
      setAdding(false)
      setNewName('')
      setNewPhone('')
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Customer</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 bg-accent/10 border border-border px-3 h-11 rounded-xl text-left active:scale-[0.99] transition-transform"
      >
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
          <User size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {value.customerId ? value.name : value.name || 'Walk-in customer'}
          </p>
          {value.mobile && <p className="text-[10px] text-muted-foreground truncate">{value.mobile}</p>}
        </div>
        <span className="text-[10px] font-semibold text-primary shrink-0">Change</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 flex items-end">
          <div onClick={(e) => e.stopPropagation()} className="w-full bg-card border-t border-border rounded-t-2xl pb-safe animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
            <div className="flex justify-center pt-2.5"><div className="w-9 h-1 rounded-full bg-muted-foreground/25" /></div>
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">Select Customer</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"><X size={16} /></button>
            </div>

            {!adding ? (
              <div className="px-3 pb-4 overflow-y-auto custom-scrollbar">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or phone..."
                    className="w-full bg-accent/10 border border-border h-11 pl-10 pr-3 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <button onClick={() => setAdding(true)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border text-primary active:bg-accent/40 transition-colors mb-2">
                  <UserPlus size={16} /><span className="text-sm font-semibold">Add new customer</span>
                </button>

                <button onClick={pickWalkIn} className={cn('w-full flex items-center justify-between p-3 rounded-xl border transition-colors mb-1', !value.customerId ? 'bg-primary/10 border-primary/30' : 'border-border active:bg-accent/40')}>
                  <span className="text-sm font-medium text-foreground">Walk-in (no saved customer)</span>
                  {!value.customerId && <Check size={15} className="text-primary" />}
                </button>

                {filtered.map((c) => (
                  <button key={c.id} onClick={() => pick(c)} className={cn('w-full flex items-center justify-between p-3 rounded-xl border transition-colors mb-1', value.customerId === c.id ? 'bg-primary/10 border-primary/30' : 'border-border active:bg-accent/40')}>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.phone || 'No phone'} · {c.totalOrders || 0} orders</p>
                    </div>
                    {value.customerId === c.id && <Check size={15} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name" className="w-full bg-accent/10 border border-border h-11 px-3 rounded-xl text-sm focus:outline-none focus:border-primary" autoFocus />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Phone (optional)</label>
                  <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className="w-full bg-accent/10 border border-border h-11 px-3 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold active:bg-accent">Back</button>
                  <button onClick={saveNew} disabled={saving || !newName.trim()} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <Plus size={15} /> {saving ? 'Saving...' : 'Add & Select'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
