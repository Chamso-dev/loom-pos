import React, { useState, useEffect } from 'react'
import { Store, MapPin, Hash, Phone, Save } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/utils'
import { LANGUAGES, useT } from '@/lib/i18n'

export default function SettingsPage() {
  const { settings, updateSettings, user, changePassword, language, setLanguage } = useStore()
  const t = useT()
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    nif: '',
    nis: '',
    rc: '',
    phone: '',
    taxEnabled: true,
    defaultTaxRate: '19',
    pricesIncludeTax: false,
    cashierPassword: ''
  })
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name,
        address: settings.address,
        nif: settings.nif || '',
        nis: settings.nis || '',
        rc: settings.rc || '',
        phone: settings.phone,
        taxEnabled: settings.taxEnabled !== false,
        defaultTaxRate: String(settings.defaultTaxRate ?? 19),
        pricesIncludeTax: !!settings.pricesIncludeTax,
        cashierPassword: settings.cashierPassword || ''
      })
    }
  }, [settings])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    await updateSettings({ ...formData, defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0 })
    setIsSaving(false)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setIsChangingPassword(true)
    setPasswordMessage({ type: '', text: '' })
    
    const result = await changePassword(user.employeeId, passwordForm.currentPassword, passwordForm.newPassword)
    
    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully' })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      setPasswordMessage({ type: 'error', text: result.error || 'Failed to update password' })
    }
    setIsChangingPassword(false)
  }


  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Store Settings</h1>
        <p className="text-[11px] text-muted-foreground">Business details & credentials</p>
      </div>

      <div className="space-y-5">
        {/* Language */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('settings.language')}</label>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={cn(
                  'h-11 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98]',
                  language === l.code ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-muted-foreground',
                )}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>

        {/* Tax (TVA) Settings */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">Tax (TVA) Settings</h3>
            <p className="text-[11px] text-muted-foreground">Configure tax once — applied to all products automatically.</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Enable TVA</span>
            <Switch
              checked={formData.taxEnabled}
              onCheckedChange={(v) => setFormData({ ...formData, taxEnabled: v })}
              aria-label="Enable TVA"
            />
          </div>

          {formData.taxEnabled && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Default TVA rate (%)</label>
                <NumberField
                  value={formData.defaultTaxRate}
                  onValueChange={(v) => setFormData({ ...formData, defaultTaxRate: v })}
                  placeholder="19"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Prices include TVA</span>
                <Switch
                  checked={formData.pricesIncludeTax}
                  onCheckedChange={(v) => setFormData({ ...formData, pricesIncludeTax: v })}
                  aria-label="Prices include TVA"
                />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                {formData.pricesIncludeTax ? 'Selling prices already contain TVA; it is extracted on each sale.' : 'TVA is added on top of selling prices at checkout.'}
              </p>
            </>
          )}

          <Button onClick={handleSubmit} disabled={isSaving} className="w-full h-11 rounded-xl text-sm font-semibold">
            <Save size={15} className="mr-2" /> {isSaving ? 'Saving…' : 'Save Tax Settings'}
          </Button>
        </div>

        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5 bg-card p-4 rounded-2xl border border-border shadow-sm">
            <div className="grid grid-cols-1 gap-6">
              {/* Store Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Store Name</label>
                <div className="relative group">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border h-10 pl-10 pr-4 rounded-md text-sm focus:outline-none focus:border-border transition-all"
                    placeholder="Enter store name"
                    required
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Business Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-background border border-border min-h-[100px] pl-10 pr-4 py-2.5 rounded-md text-sm focus:outline-none focus:border-border transition-all resize-none"
                    placeholder="Enter full address"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* NIF */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">NIF</label>
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.nif}
                      onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                      className="w-full bg-background border border-border h-11 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-primary transition-all font-mono"
                      placeholder="Numéro d'Identification Fiscale"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-background border border-border h-11 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-primary transition-all"
                      placeholder="0X XX XX XX XX"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* NIS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">NIS</label>
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.nis}
                      onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                      className="w-full bg-background border border-border h-11 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-primary transition-all font-mono"
                      placeholder="Numéro d'Identification Statistique"
                    />
                  </div>
                </div>

                {/* RC */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">RC</label>
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.rc}
                      onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                      className="w-full bg-background border border-border h-11 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-primary transition-all font-mono"
                      placeholder="Registre de Commerce"
                    />
                  </div>
                </div>
              </div>

              {/* Security Section (Global Cashier Password) */}
              <div className="pt-6 border-t border-border/40 space-y-4">
                <div className="flex items-center gap-2">
                   <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Security & Access
                   </span>
                   <div className="flex-1 h-px bg-border/40" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Global Cashier Password (OPTIONAL)</label>
                  <div className="relative group">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.cashierPassword}
                      onChange={(e) => setFormData({ ...formData, cashierPassword: e.target.value })}
                      className="w-full bg-background border border-border h-10 pl-10 pr-4 rounded-md text-sm focus:outline-none focus:border-border transition-all font-mono"
                      placeholder="Set a shared password for all cashiers"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">If set, any active cashier can use this password to log in.</p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              variant="default" 
              className="w-full h-10 text-sm font-medium"
              disabled={isSaving}
            >
              <Save size={16} className="mr-2" />
              {isSaving ? 'Saving Changes...' : 'Save Configuration'}
            </Button>
          </form>

          {/* Individual Password Change Section */}
          <form onSubmit={handlePasswordChange} className="space-y-6 bg-card p-6 rounded-lg border border-border shadow-sm">
            <div className="space-y-1">
               <h3 className="text-base font-semibold tracking-tight text-foreground">Security Credentials</h3>
               <p className="text-xs text-muted-foreground">Manage your personal password</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-background border border-border h-10 px-3 rounded-md text-sm focus:outline-none focus:border-border transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-background border border-border h-10 px-3 rounded-md text-sm focus:outline-none focus:border-border transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-background border border-border h-10 px-3 rounded-md text-sm focus:outline-none focus:border-border transition-all"
                    required
                  />
                </div>
              </div>

              {passwordMessage.text && (
                <div className={cn(
                  "p-3 rounded-md text-xs font-medium",
                  passwordMessage.type === 'success' ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                )}>
                  {passwordMessage.text}
                </div>
              )}

              <Button 
                type="submit"
                variant="outline"
                className="w-full h-10 text-sm font-medium"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Updating...' : 'Change Password'}
              </Button>
            </div>
          </form>

        </div>

        <div className="space-y-6">
          <div className="bg-accent/10 p-6 rounded-lg border border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Preview</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Header Logo</p>
                <p className="text-lg font-semibold text-foreground tracking-tight uppercase">
                  {formData.name.slice(0, 4)}<span className="text-muted-foreground">{formData.name.slice(4)}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Receipt Address</p>
                <p className="font-medium whitespace-pre-wrap text-foreground/80">{formData.address}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">NIF</p>
                <p className="font-mono font-semibold text-foreground">{formData.nif || '—'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-accent/5 p-6 rounded-lg border border-border/60">
             <p className="text-xs text-muted-foreground leading-normal">
               Note: These details will appear on all printed invoices and digital receipts generated by the system.
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
