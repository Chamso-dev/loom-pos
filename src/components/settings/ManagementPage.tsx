import { useEffect, useState } from 'react'
import {
  Users, Truck, Plus, Phone, Search, X, Edit2, Trash2,
  MapPin, StickyNote, Package, Receipt, Loader2,
} from 'lucide-react'
import { useStore, type Customer, type Supplier } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'

type Tab = 'clients' | 'suppliers'
type EditTarget =
  | { kind: 'client'; item: Customer | null }
  | { kind: 'supplier'; item: Supplier | null }
  | null

export default function ManagementPage() {
  const {
    customers, fetchCustomers, addCustomer, updateCustomer, deleteCustomer,
    suppliers, fetchSuppliers, addSupplier, updateSupplier, deleteSupplier,
    token,
  } = useStore()

  const [tab, setTab] = useState<Tab>('clients')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<EditTarget>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [supDetail, setSupDetail] = useState<any>(null)

  useEffect(() => { fetchCustomers(); fetchSuppliers() }, [fetchCustomers, fetchSuppliers])

  const openClientDetail = async (c: Customer) => {
    setDetail({ ...c, orders: null })
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/customers/${c.id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setDetail(await res.json())
    } finally {
      setDetailLoading(false)
    }
  }

  const openSupplierDetail = async (s: Supplier) => {
    setSupDetail({ ...s, products: null })
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/products?limit=500`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        const linked = (data.products || []).filter((p: any) => (p.supplier || '') === s.name)
        setSupDetail({ ...s, products: linked })
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const q = search.toLowerCase()
  const clients = customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(search))
  const sups = suppliers.filter((s) => s.name.toLowerCase().includes(q) || (s.phone || '').includes(search))

  return (
    <div className="space-y-4 animate-in fade-in duration-300 font-sans">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Management</h1>
        <p className="text-[11px] text-muted-foreground">Clients &amp; suppliers</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary p-1 rounded-xl border border-border">
        {([['clients', Users, 'Clients'], ['suppliers', Truck, 'Suppliers']] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors',
              tab === key ? 'bg-card text-foreground border border-border shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Icon size={14} /> {label}
            <span className="text-[10px] opacity-60">({key === 'clients' ? customers.length : suppliers.length})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}...`} className="pl-10 h-12 bg-card border-border rounded-xl text-sm" />
      </div>

      {/* Lists */}
      {tab === 'clients' ? (
        <div className="space-y-2.5">
          {clients.length === 0 && <Empty label="No clients yet" />}
          {clients.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-3.5 shadow-sm">
              <button onClick={() => openClientDetail(c)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0"><Users size={15} /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone size={9} /> {c.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(c.totalSpent || 0)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{c.totalOrders || 0} orders</p>
                  </div>
                </div>
              </button>
              <RowActions
                onEdit={() => setEdit({ kind: 'client', item: c })}
                onDelete={async () => { if (confirm(`Delete client "${c.name}"?`)) await deleteCustomer(c.id) }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sups.length === 0 && <Empty label="No suppliers yet" />}
          {sups.map((s) => (
            <div key={s.id} className="bg-card rounded-2xl border border-border p-3.5 shadow-sm">
              <button onClick={() => openSupplierDetail(s)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0"><Truck size={15} /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone size={9} /> {s.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary border border-border text-[10px] font-bold text-foreground shrink-0">
                    <Package size={11} /> {s.linkedProducts || 0}
                  </div>
                </div>
                {s.address && <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5"><MapPin size={11} /> {s.address}</p>}
              </button>
              <RowActions
                onEdit={() => setEdit({ kind: 'supplier', item: s })}
                onDelete={async () => { if (confirm(`Delete supplier "${s.name}"?`)) await deleteSupplier(s.id) }}
              />
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setEdit({ kind: tab === 'clients' ? 'client' : 'supplier', item: null })}
        aria-label="Add"
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={24} />
      </button>

      {edit && (
        <EditSheet
          target={edit}
          onClose={() => setEdit(null)}
          onSubmitClient={async (data) => { edit.item ? await updateCustomer(edit.item.id, data) : await addCustomer(data); setEdit(null) }}
          onSubmitSupplier={async (data) => { edit.item ? await updateSupplier((edit.item as Supplier).id, data) : await addSupplier(data); setEdit(null) }}
        />
      )}

      {detail && (
        <ClientDetailSheet detail={detail} loading={detailLoading} onClose={() => setDetail(null)} />
      )}

      {supDetail && (
        <SupplierDetailSheet detail={supDetail} loading={detailLoading} onClose={() => setSupDetail(null)} />
      )}
    </div>
  )
}

function SupplierDetailSheet({ detail, loading, onClose }: { detail: any; loading: boolean; onClose: () => void }) {
  return (
    <Sheet title={detail.name} onClose={onClose}>
      {detail.phone && <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><Phone size={12} /> {detail.phone}</p>}
      {detail.address && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5"><MapPin size={12} /> {detail.address}</p>}

      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">Linked Products</p>
      {loading || !detail.products ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : detail.products.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No products linked to this supplier yet</p>
      ) : (
        <div className="space-y-2">
          {detail.products.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Package size={14} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.category} · {p.productType === 'WEIGHTED' ? `${p.stock} kg` : `${p.stock} units`}</p>
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0 text-foreground">{formatCurrency(p.sellingPrice)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-14 text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl">{label}</div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
      <Button variant="outline" onClick={onEdit} className="flex-1 h-9 rounded-xl text-xs"><Edit2 size={13} className="mr-1.5" /> Edit</Button>
      <Button variant="ghost" onClick={onDelete} className="w-10 h-9 p-0 rounded-xl text-red-500 border border-red-500/20 hover:bg-red-500/10"><Trash2 size={14} /></Button>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 flex items-end">
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-card border-t border-border rounded-t-2xl pb-safe animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-2.5"><div className="w-9 h-1 rounded-full bg-muted-foreground/25" /></div>
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"><X size={16} /></button>
        </div>
        <div className="px-4 pb-4 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  )
}

function Field({ icon, label, ...props }: { icon: React.ReactNode; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input {...props} className="h-11 pl-9 text-sm rounded-xl" />
      </div>
    </div>
  )
}

function EditSheet({ target, onClose, onSubmitClient, onSubmitSupplier }: {
  target: NonNullable<EditTarget>
  onClose: () => void
  onSubmitClient: (d: any) => void
  onSubmitSupplier: (d: any) => void
}) {
  const isClient = target.kind === 'client'
  const item: any = target.item
  const [name, setName] = useState(item?.name || '')
  const [phone, setPhone] = useState(item?.phone || '')
  const [address, setAddress] = useState(item?.address || '')
  const [notes, setNotes] = useState(item?.notes || '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (isClient) onSubmitClient({ name: name.trim(), phone: phone.trim() || null, notes: notes.trim() || null })
    else onSubmitSupplier({ name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null })
  }

  return (
    <Sheet title={`${item ? 'Edit' : 'New'} ${isClient ? 'Client' : 'Supplier'}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field icon={isClient ? <Users size={15} /> : <Truck size={15} />} label={isClient ? 'Full Name' : 'Supplier Name'} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required autoFocus />
        <Field icon={<Phone size={15} />} label={`Phone${isClient ? ' (optional)' : ''}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" />
        {!isClient && (
          <Field icon={<MapPin size={15} />} label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
          <div className="relative">
            <StickyNote size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
        </div>
        <Button type="submit" className="w-full h-11 rounded-xl text-sm mt-1">{item ? 'Save Changes' : 'Add'}</Button>
      </form>
    </Sheet>
  )
}

function ClientDetailSheet({ detail, loading, onClose }: { detail: any; loading: boolean; onClose: () => void }) {
  return (
    <Sheet title={detail.name} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-accent/20 rounded-xl p-3 border border-border/60">
          <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Total Spent</p>
          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{formatCurrency(detail.totalSpent || 0)}</p>
        </div>
        <div className="bg-accent/20 rounded-xl p-3 border border-border/60">
          <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Total Orders</p>
          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{detail.totalOrders || 0}</p>
        </div>
      </div>
      {detail.phone && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5"><Phone size={12} /> {detail.phone}</p>}

      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">Purchase History</p>
      {loading || !detail.orders ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : detail.orders.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No purchases yet</p>
      ) : (
        <div className="space-y-2">
          {detail.orders.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt size={14} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground font-mono">{o.invoiceNo}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(o.date), 'dd MMM yyyy')}</p>
                </div>
              </div>
              <span className={cn('text-sm font-bold tabular-nums', o.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'text-foreground')}>{formatCurrency(o.totalAmount)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
