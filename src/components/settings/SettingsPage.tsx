import { useEffect, useState, type ReactNode } from 'react'
import { Save } from 'lucide-react'
import { useStore, type StoreSettings } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { ErrorNote, Field, SelectInput, TextArea, TextInput } from '@/components/ui/field'
import { LANGUAGES, useI18n } from '@/i18n'
import { PAYMENT_METHODS } from '@/lib/domain'
import type { Lang } from '@/i18n/define'
import { cn } from '@/lib/utils'

type Form = Omit<StoreSettings, 'id' | 'hasCashierPassword' | 'currency'>

const toForm = (s: StoreSettings | null): Form => ({
  name: s?.name ?? 'LoomPOS',
  address: s?.address ?? '',
  phone: s?.phone ?? '',
  nif: s?.nif ?? '',
  rc: s?.rc ?? '',
  nis: s?.nis ?? '',
  articleNo: s?.articleNo ?? '',
  language: s?.language ?? 'ar',
  defaultPaymentMethod: s?.defaultPaymentMethod ?? 'CASH',
  ripAccount: s?.ripAccount ?? '',
  ribAccount: s?.ribAccount ?? '',
  receiptWidth: s?.receiptWidth ?? 80,
  receiptFooter: s?.receiptFooter ?? '',
  receiptShowTax: s?.receiptShowTax ?? true,
})

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="bg-card p-6 rounded-lg border border-border space-y-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

const twentyDigits = (v: string) => !v || /^\d{20}$/.test(v.replace(/\s/g, ''))

export default function SettingsPage() {
  const { settings, updateSettings, user, changePassword, language, setLanguage } = useStore()
  const i18n = useI18n()
  const { t, method } = i18n
  const [form, setForm] = useState<Form>(toForm(settings))
  const [cashierPassword, setCashierPassword] = useState('')
  const [removeShared, setRemoveShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => setForm(toForm(settings)), [settings])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cashierPassword && cashierPassword.length < 6) {
      setError({ code: 'VALIDATION' })
      return
    }
    setSaving(true)
    setError(null)
    const result = await updateSettings({
      ...form,
      ...(removeShared ? { cashierPassword: null } : cashierPassword ? { cashierPassword } : {}),
    })
    setSaving(false)
    if (result.ok) {
      setSaved(true)
      setCashierPassword('')
      setRemoveShared(false)
    } else setError(result.error)
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (pw.next.length < 6) return setPwMessage({ ok: false, text: t('settings.passwordTooShort') })
    if (pw.next !== pw.confirm) return setPwMessage({ ok: false, text: t('settings.passwordMismatch') })
    const result = await changePassword(user.employeeId, pw.current, pw.next)
    if (result.success) {
      setPwMessage({ ok: true, text: t('settings.passwordChanged') })
      setPw({ current: '', next: '', confirm: '' })
    } else setPwMessage({ ok: false, text: i18n.error(result.error) })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Section title={t('settings.localization')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.language')} hint={t('settings.languageHint')}>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.language')}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    role="radio"
                    lang={l.code}
                    aria-checked={language === l.code}
                    onClick={() => {
                      setLanguage(l.code as Lang)
                      set('language', l.code as Lang)
                    }}
                    className={cn('h-10 rounded-md border text-sm font-semibold', language === l.code ? 'border-primary bg-primary/10 text-link' : 'border-border hover:bg-accent')}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('settings.currency')} hint={t('settings.currencyHint')}>
              <SelectInput value="DZD" disabled>
                <option value="DZD">{t('common.currency')}</option>
              </SelectInput>
            </Field>
          </div>
        </Section>

        <Section title={t('settings.store')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.storeName')} className="sm:col-span-2">
              <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label={t('settings.address')} className="sm:col-span-2">
              <TextArea value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={t('settings.addressPlaceholder')} />
            </Field>
            <Field label={t('settings.phone')}>
              <TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t('common.phonePlaceholder')} dir="ltr" inputMode="tel" className="text-start" />
            </Field>
          </div>
        </Section>

        <Section title={t('settings.identifiers')} hint={t('settings.identifiersHint')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['nif', 'rc', 'nis', 'articleNo'] as const).map((k) => (
              <Field key={k} label={t(`settings.${k}`)}>
                <TextInput value={form[k]} onChange={(e) => set(k, e.target.value)} dir="ltr" className="text-start" />
              </Field>
            ))}
          </div>
        </Section>

        <Section title={t('settings.payments')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.defaultMethod')} hint={t('settings.defaultMethodHint')} className="sm:col-span-2">
              <SelectInput value={form.defaultPaymentMethod} onChange={(e) => set('defaultPaymentMethod', e.target.value as Form['defaultPaymentMethod'])}>
                {PAYMENT_METHODS.filter((m) => !m.onAccount).map((m) => (
                  <option key={m.code} value={m.code}>{method(m.code)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t('settings.rip')} hint={t('settings.ripHint')} error={!twentyDigits(form.ripAccount) ? t('settings.digitsWarning') : undefined}>
              <TextInput value={form.ripAccount} onChange={(e) => set('ripAccount', e.target.value)} dir="ltr" inputMode="numeric" className="text-start" />
            </Field>
            <Field label={t('settings.rib')} hint={t('settings.ribHint')} error={!twentyDigits(form.ribAccount) ? t('settings.digitsWarning') : undefined}>
              <TextInput value={form.ribAccount} onChange={(e) => set('ribAccount', e.target.value)} dir="ltr" inputMode="numeric" className="text-start" />
            </Field>
          </div>
        </Section>

        <Section title={t('settings.receipts')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.paperWidth')}>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('settings.paperWidth')}>
                {([58, 80] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={form.receiptWidth === w}
                    onClick={() => set('receiptWidth', w)}
                    className={cn('h-10 rounded-md border text-sm font-semibold', form.receiptWidth === w ? 'border-primary bg-primary/10 text-link' : 'border-border hover:bg-accent')}
                  >
                    {w === 58 ? t('settings.width58') : t('settings.width80')}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('settings.footer')}>
              <TextInput value={form.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} placeholder={t('settings.footerPlaceholder')} maxLength={200} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer">
              <input type="checkbox" checked={form.receiptShowTax} onChange={(e) => set('receiptShowTax', e.target.checked)} className="h-4 w-4 accent-primary" />
              {t('settings.showTax')}
            </label>
          </div>
        </Section>

        <Section title={t('settings.security')} hint={settings?.hasCashierPassword ? t('settings.cashierPasswordSet') : t('settings.cashierPasswordUnset')}>
          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <Field label={t('settings.newCashierPassword')} hint={t('settings.cashierPasswordHint')}>
              <TextInput type="password" value={cashierPassword} onChange={(e) => setCashierPassword(e.target.value)} disabled={removeShared} dir="ltr" autoComplete="new-password" className="text-start" />
            </Field>
            {settings?.hasCashierPassword && (
              <label className="flex items-center gap-2 text-sm cursor-pointer pb-6">
                <input type="checkbox" checked={removeShared} onChange={(e) => setRemoveShared(e.target.checked)} className="h-4 w-4 accent-primary" />
                {t('settings.removeCashierPassword')}
              </label>
            )}
          </div>
        </Section>

        {error != null && <ErrorNote>{i18n.error(error)}</ErrorNote>}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving} className="gap-2 h-11 px-6">
            <Save size={16} /> {saving ? t('common.saving') : t('settings.save')}
          </Button>
          {saved && <span role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('settings.saved')}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="bg-card p-6 rounded-lg border border-border space-y-4">
        <h2 className="text-base font-semibold">{t('settings.myPassword')}</h2>
        <Field label={t('settings.currentPassword')}>
          <TextInput type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required dir="ltr" autoComplete="current-password" className="text-start" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.newPassword')}>
            <TextInput type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required dir="ltr" autoComplete="new-password" className="text-start" />
          </Field>
          <Field label={t('settings.confirmPassword')}>
            <TextInput type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required dir="ltr" autoComplete="new-password" className="text-start" />
          </Field>
        </div>
        {pwMessage && (
          <p role="status" className={cn('rounded-md px-3 py-2 text-sm font-medium', pwMessage.ok ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-destructive/10 text-destructive')}>
            {pwMessage.text}
          </p>
        )}
        <Button type="submit" variant="outline">{t('settings.changePassword')}</Button>
      </form>
    </div>
  )
}
