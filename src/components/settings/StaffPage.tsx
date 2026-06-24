import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Shield, Smartphone, Key, X, Check, Search, UserMinus, RotateCw, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react'
import { useStore, type User } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function StaffPage() {
  const { users, fetchUsers, addUser, updateUser, requestResetToken, resetStaffPassword } = useStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Form states
  const [name, setName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER')
  const [isActive, setIsActive] = useState(true)

  // Reveal functionality states
  const [isRevealing, setIsRevealing] = useState(false)
  const [adminVerifyKey, setAdminVerifyKey] = useState('')
  const [revealError, setRevealError] = useState('')
  const [isRevealLoading, setIsRevealLoading] = useState(false)
  const [showStaffPassword, setShowStaffPassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const openModal = (user?: User) => {
    setIsRevealing(false)
    setAdminVerifyKey('')
    setRevealError('')
    setShowStaffPassword(false)
    setShowResetPassword(false)
    
    if (user) {
      setEditingUser(user)
      setName(user.name)
      setEmployeeId(user.employeeId)
      setPhone(user.phone || '')
      setRole(user.role)
      setIsActive(user.isActive)
      setPassword('')
    } else {
      setEditingUser(null)
      setName('')
      setEmployeeId('')
      setPhone('')
      setRole('CASHIER')
      setIsActive(true)
      setPassword('')
      setShowStaffPassword(true) // Show by default for new users
    }
    setIsModalOpen(true)
  }

  const handleReset = async () => {
    if (!editingUser) return
    if (!password || password.length < 6) {
      setRevealError('New password must be at least 6 characters')
      return
    }
    
    setIsRevealLoading(true)
    setRevealError('')
    
    const tokenResult = await requestResetToken(editingUser.id)
    
    if (tokenResult.success && tokenResult.resetToken) {
      const resetResult = await resetStaffPassword(editingUser.id, tokenResult.resetToken, password)
      if (resetResult.success) {
        setIsRevealing(false)
        setShowStaffPassword(false)
        setAdminVerifyKey('')
        setPassword('')
        setIsModalOpen(false)
      } else {
        setRevealError(resetResult.error || 'Reset failed')
      }
    } else {
      setRevealError(tokenResult.error || 'Verification failed')
    }
    setIsRevealLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const userData = { name, employeeId, phone, role, isActive }
    if (password) (userData as any).password = password

    if (editingUser) {
      await updateUser(editingUser.id, userData)
    } else {
      await addUser(userData)
    }
    setIsLoading(false)
    setIsModalOpen(false)
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.employeeId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground border border-border shrink-0">
          <Users size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">Staff</h1>
          <p className="text-[11px] text-muted-foreground truncate">Access & credentials</p>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search staff..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 bg-card border-border text-sm rounded-xl"
        />
      </div>

      <div className="space-y-3">
        {filteredUsers.map(user => (
          <div
            key={user.id}
            className={cn(
              "bg-card rounded-2xl border border-border p-4 transition-all duration-200 relative overflow-hidden shadow-sm",
              !user.isActive && "opacity-60 grayscale"
            )}
          >
            <div className="flex items-start justify-between relative z-10">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-200">
                     <Users size={20} />
                  </div>
                  <div>
                     <h3 className="font-semibold text-base tracking-tight leading-none text-foreground">{user.name}</h3>
                     <p className="text-[10px] uppercase text-muted-foreground tracking-wider mt-1.5 font-medium">ID: {user.employeeId}</p>
                  </div>
               </div>
               <div className={cn(
                 "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                 user.role === 'ADMIN' ? "bg-primary/10 text-primary border-primary/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
               )}>
                  {user.role}
               </div>
            </div>

            <div className="mt-6 space-y-3 relative z-10">
               <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Smartphone size={13} className="opacity-60" />
                  <span className="text-[11px] font-medium">{user.phone || 'No contact saved'}</span>
               </div>
               <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Check size={13} className={cn("opacity-60", user.isActive ? "text-emerald-500" : "text-red-500")} />
                  <span className="text-[11px] font-medium">
                     {user.isActive ? 'Active Duty' : 'Deactivated / Ex-Staff'}
                  </span>
               </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex gap-2 relative z-10">
               <Button
                variant="outline"
                onClick={() => openModal(user)}
                className="flex-1 h-10 rounded-xl text-xs border-border"
               >
                  Edit Profile
               </Button>
               <Button
                variant="ghost"
                onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                className="w-10 h-10 p-0 rounded-xl text-muted-foreground border border-border"
               >
                  {user.isActive ? <UserMinus size={15} /> : <RotateCw size={15} />}
               </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Add Staff button */}
      {!isModalOpen && (
        <button
          onClick={() => openModal()}
          aria-label="Add staff"
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          <UserPlus size={22} />
        </button>
      )}

      {/* User Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md rounded-lg border border-border shadow-lg animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden max-h-[90vh]">
              <div className="p-4 border-b border-border/40 flex items-center justify-between">
                 <div>
                    <h2 className="text-base font-semibold text-foreground">{editingUser ? 'Modify Credentials' : 'Request Access'}</h2>
                    <p className="text-[10px] text-muted-foreground">Personnel Management System</p>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <X size={16} />
                 </Button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto overflow-x-hidden">
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-9 bg-background border-border text-sm" required />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Employee ID</label>
                          <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" className="h-9 bg-background border-border text-sm uppercase" required />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Contact Phone</label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 0000..." className="h-9 bg-background border-border text-sm" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Access Role</label>
                          <div className="grid grid-cols-2 gap-1.5">
                             {['ADMIN', 'CASHIER'].map((r: any) => (
                               <button
                                 key={r}
                                 type="button"
                                 onClick={() => setRole(r)}
                                 className={cn(
                                   "py-1.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider transition-all",
                                   role === r ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
                                 )}
                               >
                                 {r}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                             {editingUser ? 'Reset Security Key' : 'Initial Security Key'}
                          </label>
                          {editingUser && !isRevealing && (
                             <button 
                               type="button"
                               onClick={() => setIsRevealing(true)}
                               className="text-xs font-medium text-primary hover:underline"
                             >
                                Reset Password
                             </button>
                          )}
                       </div>

                       {isRevealing ? (
                          <div className="space-y-3 p-4 bg-accent/20 rounded-md border border-border/40 animate-in slide-in-from-top-4 duration-200">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                   <ShieldCheck size={14} />
                                   <span className="text-xs font-medium">Admin Configured</span>
                                </div>
                                <button type="button" onClick={() => setIsRevealing(false)} className="text-xs font-medium text-primary hover:underline">Cancel</button>
                             </div>
                             
                             <div className="flex gap-2">
                                  <div className="relative flex-1">
                                     <Input 
                                       type={showResetPassword ? "text" : "password"}
                                       placeholder="New Password"
                                       value={password}
                                       onChange={(e) => setPassword(e.target.value)}
                                       className="h-9 bg-background border-border text-sm pr-10"
                                     />
                                     <button
                                       type="button"
                                       onClick={() => setShowResetPassword(!showResetPassword)}
                                       className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                     >
                                        {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                     </button>
                                  </div>
                                  <Button 
                                    type="button"
                                    onClick={handleReset}
                                    disabled={isRevealLoading || password.length < 6}
                                    className="h-9 px-3 rounded-md text-xs font-medium"
                                  >
                                     {isRevealLoading ? '...' : 'Reset'}
                                  </Button>
                               </div>
                             {revealError && (
                                <div className="flex items-center gap-1.5 text-destructive">
                                   <AlertCircle size={10} />
                                   <span className="text-[10px] font-medium uppercase tracking-wider">{revealError}</span>
                                </div>
                             )}
                          </div>
                       ) : (
                          <div className="relative group">
                             <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                             <Input 
                               type={showStaffPassword ? "text" : "password"} 
                               value={password} 
                               onChange={(e) => setPassword(e.target.value)} 
                               placeholder={editingUser ? "••••••••" : "MIN 6 CHARS"} 
                               className="h-9 bg-background border-border text-sm pl-9 pr-9" 
                               required={!editingUser} 
                               disabled={!!editingUser}
                             />
                             {!editingUser && (
                               <button
                                 type="button"
                                 onClick={() => setShowStaffPassword(!showStaffPassword)}
                                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showStaffPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              )}
                          </div>
                       )}
                    </div>
                 </div>

                 <Button 
                   type="submit" 
                   disabled={isLoading || isRevealing}
                   className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-xs mt-4"
                 >
                    {isLoading ? 'Processing...' : editingUser ? 'Apply Updates' : 'Grant Permissions'}
                 </Button>
              </form>
            </div>
        </div>
      )}
    </div>
  )
}
