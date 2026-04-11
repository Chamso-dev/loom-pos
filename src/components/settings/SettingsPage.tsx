import React, { useState, useEffect } from 'react'
import { Store, MapPin, Hash, Phone, CreditCard, Save } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { settings, updateSettings, user, changePassword } = useStore()
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    gstin: '',
    upiId: '',
    phone: '',
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
        gstin: settings.gstin,
        upiId: settings.upiId,
        phone: settings.phone,
        cashierPassword: settings.cashierPassword || ''
      })
    }
  }, [settings])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    await updateSettings(formData)
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
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-black tracking-tight uppercase italic mb-2">Store Settings</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Configure your business details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-[2rem] border border-border/60 shadow-xl shadow-primary/5">
            <div className="grid grid-cols-1 gap-6">
              {/* Store Name */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Store Name</label>
                <div className="relative group">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    placeholder="Enter store name"
                    required
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Business Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 min-h-[100px] pl-12 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none"
                    placeholder="Enter full address"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* GSTIN */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">GSTIN</label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      placeholder="Enter GSTIN"
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Contact Phone</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* UPI ID */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">UPI ID for Payments</label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={formData.upiId}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-mono"
                    placeholder="Enter UPI ID (e.g. store@upi)"
                    required
                  />
                </div>
              </div>

              {/* Security Section (Global Cashier Password) */}
              <div className="pt-6 border-t border-border/40 space-y-6">
                <div className="flex items-center gap-2">
                   <div className="p-2 bg-primary/10 rounded-lg text-primary text-xs font-black uppercase tracking-widest">
                      Security & Access
                   </div>
                   <div className="flex-1 h-px bg-border/40" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Global Cashier Password (OPTIONAL)</label>
                  <div className="relative group">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={formData.cashierPassword}
                      onChange={(e) => setFormData({ ...formData, cashierPassword: e.target.value })}
                      className="w-full bg-accent/30 border border-border/50 h-12 pl-12 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-mono"
                      placeholder="Set a shared password for all cashiers"
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground italic px-1">If set, any active cashier can use this password to log in.</p>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              variant="premium" 
              className="w-full h-14 text-lg font-black uppercase tracking-widest"
              disabled={isSaving}
            >
              <Save size={20} className="mr-2" />
              {isSaving ? 'Saving Changes...' : 'Save Configuration'}
            </Button>
          </form>

          {/* Individual Password Change Section */}
          <form onSubmit={handlePasswordChange} className="mt-8 space-y-6 bg-card p-8 rounded-[2rem] border border-border/60 shadow-xl shadow-primary/5">
            <div className="space-y-2 mb-6">
               <h3 className="text-xl font-bold tracking-tight">Security Credentials</h3>
               <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Manage your personal password</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-accent/30 border border-border/50 h-12 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 h-12 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-accent/30 border border-border/50 h-12 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>
              </div>

              {passwordMessage.text && (
                <div className={cn(
                  "p-4 rounded-xl text-xs font-bold uppercase tracking-widest",
                  passwordMessage.type === 'success' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                )}>
                  {passwordMessage.text}
                </div>
              )}

              <Button 
                type="submit"
                variant="outline"
                className="w-full h-12 font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Updating...' : 'Change Password'}
              </Button>
            </div>
          </form>

        </div>

        <div className="space-y-6">
          <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/20">
            <h3 className="font-black uppercase tracking-tight mb-4">Preview</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] uppercase opacity-40 font-bold">Header Logo</p>
                <p className="text-xl font-bold text-primary italic uppercase tracking-tighter">
                  {formData.name.slice(0, 4)}<span className="text-foreground">{formData.name.slice(4)}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-40 font-bold">Receipt Address</p>
                <p className="font-medium whitespace-pre-wrap">{formData.address}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase opacity-40 font-bold">GST Number</p>
                <p className="font-mono font-bold">{formData.gstin}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-accent/30 p-8 rounded-[2rem] border border-border/60">
             <p className="text-xs text-muted-foreground leading-relaxed italic">
               Note: These details will appear on all printed invoices and digital receipts generated by the system.
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
