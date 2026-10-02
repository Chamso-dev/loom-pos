import { useEffect, useState } from 'react'
import { Users, UserPlus, Smartphone, Search, UserMinus, RotateCw, Eye, EyeOff, Check } from 'lucide-react'
import { useStore, type User } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import Modal from '@/components/ui/modal'
import { ErrorNote, Field, TextInput } from '@/components/ui/field'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function StaffPage() {
  const { users, fetchUsers, addUser, updateUser, requestResetToken, resetStaffPassword } = useStore()
  const i18n = useI18n()
  const { t } = i18n
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER')
  const [showPassword, setShowPassword] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const openModal = (user?: User) => {
    setEditingUser(user ?? null)
    setName(user?.name ?? '')
    setEmployeeId(user?.employeeId ?? '')
    setPhone(user?.phone ?? '')
    setRole(user?.role ?? 'CASHIER')
    setPassword('')
    setShowPassword(!user)
    setResetting(false)
    setError(null)
    setNotice('')
    setIsModalOpen(true)
  }

  const handleReset = async () => {
    if (!editingUser || password.length < 6) return
    setSaving(true)
    setError(null)
    const token = await requestResetToken(editingUser.id)
    const result = token.success && token.resetToken ? await resetStaffPassword(editingUser.id, token.resetToken, password) : token
    setSaving(false)
    if (result.success) {
      setNotice(t('staff.passwordReset'))
      setResetting(false)
      setPassword('')
    } else setError(result.error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const data: Record<string, unknown> = { name, employeeId, phone: phone || null, role }
    if (!editingUser) data.password = password
    const result = editingUser ? await updateUser(editingUser.id, data) : await addUser({ ...data, isActive: true })
    setSaving(false)
    if (result.ok) setIsModalOpen(false)
    else setError(result.error)
  }

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.employeeId.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">{t('staff.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('staff.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative md:w-64">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('staff.searchPlaceholder')} aria-label={t('staff.searchPlaceholder')} className="w-full ps-9 pe-3 h-10 rounded-md border border-border bg-background text-sm" />
          </div>
          <Button onClick={() => openModal()} className="h-10 gap-2">
            <UserPlus size={16} /> {t('staff.addStaff')}
          </Button>
        </div>
      </div>

      {filtered.length === 0 && <p className="text-muted-foreground">{t('staff.none')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((user) => (
          <div key={user.id} className={cn('bg-card rounded-lg border border-border p-6', !user.isActive && 'opacity-60')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-md bg-accent flex items-center justify-center text-muted-foreground"><Users size={20} /></div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{user.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('staff.id', { id: i18n.code(user.employeeId) })}</p>
                </div>
              </div>
              <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border', user.role === 'ADMIN' ? 'bg-primary/10 text-link border-primary/20' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20')}>
                {t(`nav.roles.${user.role}`)}
              </span>
            </div>
            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Smartphone size={13} /> {user.phone ? i18n.phone(user.phone) : t('common.noContact')}</p>
              <p className="flex items-center gap-2"><Check size={13} className={user.isActive ? 'text-emerald-600' : 'text-red-500'} /> {user.isActive ? t('staff.active') : t('staff.inactive')}</p>
            </div>
            <div className="mt-5 pt-4 border-t border-border flex gap-2">
              <Button variant="outline" onClick={() => openModal(user)} className="flex-1 h-9">{t('staff.edit')}</Button>
              <Button
                variant="ghost"
                onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                aria-label={user.isActive ? t('staff.deactivate', { name: user.name }) : t('staff.reactivate', { name: user.name })}
                title={user.isActive ? t('staff.deactivate', { name: user.name }) : t('staff.reactivate', { name: user.name })}
                className="w-9 h-9 p-0 border border-border"
              >
                {user.isActive ? <UserMinus size={15} /> : <RotateCw size={15} />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <Modal
          title={editingUser ? t('staff.formEdit') : t('staff.formAdd')}
          onClose={() => setIsModalOpen(false)}
          locked={saving}
          footer={
            <Button type="submit" form="staff-form" disabled={saving || resetting} className="w-full">
              {saving ? t('common.saving') : editingUser ? t('staff.update') : t('staff.create')}
            </Button>
          }
        >
          <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('staff.fullName')}>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label={t('staff.employeeId')}>
                <TextInput value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder={t('staff.employeeIdPlaceholder')} required dir="ltr" className="text-start" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('common.phone')} (${t('common.optional')})`}>
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('common.phonePlaceholder')} dir="ltr" inputMode="tel" className="text-start" />
              </Field>
              <Field label={t('staff.role')}>
                <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t('staff.role')}>
                  {(['ADMIN', 'CASHIER'] as const).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={cn('h-10 rounded-md border text-xs font-semibold', role === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {t(`nav.roles.${r}`)}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {!editingUser ? (
              <Field label={t('staff.password')} hint={t('staff.passwordHint')}>
                <div className="relative" dir="ltr">
                  <TextInput type={showPassword ? 'text' : 'password'} aria-label={t('staff.password')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" autoComplete="new-password" className="pe-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('staff.hidePassword') : t('staff.showPassword')} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
            ) : resetting ? (
              <div className="rounded-md border border-border bg-accent/20 p-3 space-y-2">
                <Field label={t('staff.newPassword')} hint={t('staff.passwordHint')}>
                  <div className="flex gap-2">
                    <TextInput type="text" aria-label={t('staff.newPassword')} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="new-password" className="text-start" />
                    <Button type="button" onClick={handleReset} disabled={saving || password.length < 6}>{t('staff.reset')}</Button>
                  </div>
                </Field>
                <button type="button" onClick={() => setResetting(false)} className="text-xs text-muted-foreground hover:underline">{t('common.cancel')}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setResetting(true)} className="text-sm font-medium text-link hover:underline">{t('staff.resetPassword')}</button>
            )}
            {notice && <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>}
            {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
          </form>
        </Modal>
      )}
    </div>
  )
}
