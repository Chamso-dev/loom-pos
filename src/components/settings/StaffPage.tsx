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
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg shadow-primary/5">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Staff Operations</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.3em] font-bold">Manage system access & credentials</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="relative group flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 w-4 h-4 group-focus-within:text-primary transition-colors" />
              <Input 
               placeholder="Search by ID or Name..." 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="pl-10 h-12 bg-card/50 border-border/40 rounded-2xl font-bold text-xs focus:ring-2 focus:ring-primary/10"
              />
           </div>
           <Button variant="premium" onClick={() => openModal()} className="h-12 px-6 gap-2 rounded-2xl uppercase font-black text-xs tracking-widest shadow-lg shadow-primary/20">
             <UserPlus size={18} />
             Add Staff
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(user => (
          <div 
            key={user.id} 
            className={cn(
              "group bg-card/40 backdrop-blur-xl rounded-[2.5rem] border border-border/40 p-6 hover:border-primary/40 transition-all duration-500 relative overflow-hidden",
              !user.isActive && "opacity-60 grayscale"
            )}
          >
            {/* Background Decorative Role Icon */}
            <div className="absolute top-[-20px] right-[-20px] opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700">
               <Shield size={120} />
            </div>

            <div className="flex items-start justify-between relative z-10">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500">
                     <Users size={24} />
                  </div>
                  <div>
                     <h3 className="font-black text-lg tracking-tight leading-none group-hover:text-primary transition-colors">{user.name}</h3>
                     <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1.5 opacity-60">ID: {user.employeeId}</p>
                  </div>
               </div>
               <div className={cn(
                 "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                 user.role === 'ADMIN' ? "bg-primary/10 text-primary border-primary/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
               )}>
                  {user.role}
               </div>
            </div>

            <div className="mt-8 space-y-4 relative z-10">
               <div className="flex items-center gap-3 text-muted-foreground">
                  <Smartphone size={14} className="opacity-40" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">{user.phone || 'No contact saved'}</span>
               </div>
               <div className="flex items-center gap-3 text-muted-foreground">
                  <Check size={14} className={cn("opacity-40", user.isActive ? "text-emerald-500" : "text-red-500")} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">
                     {user.isActive ? 'Active Duty' : 'Deactivated / Ex-Staff'}
                  </span>
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/20 flex gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
               <Button 
                variant="outline" 
                onClick={() => openModal(user)}
                className="flex-1 h-10 rounded-xl uppercase font-black text-[9px] tracking-[0.2em] border-border/40 hover:bg-primary hover:text-white transition-all"
               >
                  Edit Profile
               </Button>
               <Button 
                variant="ghost" 
                onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                className="w-10 h-10 p-0 rounded-xl hover:bg-accent border border-transparent hover:border-border"
               >
                  {user.isActive ? <UserMinus size={16} /> : <RotateCw size={16} />}
               </Button>
            </div>
          </div>
        ))}
      </div>

      {/* User Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-md rounded-[2.5rem] border border-border/60 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden max-h-[90vh]">
              <div className="p-6 border-b border-border/40 flex items-center justify-between bg-accent/10">
                 <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">{editingUser ? 'Modify Credentials' : 'Request Access'}</h2>
                    <p className="text-[9px] uppercase font-black text-muted-foreground opacity-60 tracking-[0.2em]">Personnel Management System</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-background rounded-full border border-border/40 transition-all">
                    <X size={18} />
                 </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto overflow-x-hidden">
                 <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground pl-1">Full Name</label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-11 bg-accent/20 border-border/40 rounded-xl font-bold text-xs px-4" required />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground pl-1">Employee ID</label>
                          <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" className="h-11 bg-accent/20 border-border/40 rounded-xl font-bold text-xs px-4 uppercase" required />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground pl-1">Contact Phone</label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 0000..." className="h-11 bg-accent/20 border-border/40 rounded-xl font-bold text-xs px-4" />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground pl-1">Access Role</label>
                          <div className="grid grid-cols-2 gap-1.5">
                             {['ADMIN', 'CASHIER'].map((r: any) => (
                               <button
                                 key={r}
                                 type="button"
                                 onClick={() => setRole(r)}
                                 className={cn(
                                   "py-2.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all",
                                   role === r ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "bg-background border-border"
                                 )}
                               >
                                 {r}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between pr-1">
                          <label className="text-[9px] uppercase font-black tracking-widest text-muted-foreground pl-1">
                             {editingUser ? 'Reset Security Key' : 'Initial Security Key'}
                          </label>
                          {editingUser && !isRevealing && (
                             <button 
                               type="button"
                               onClick={() => setIsRevealing(true)}
                               className="text-[9px] uppercase font-black text-primary tracking-widest hover:underline"
                             >
                                Reset Password
                             </button>
                          )}
                       </div>

                       {isRevealing ? (
                          <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/20 animate-in slide-in-from-top-4 duration-300">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-primary">
                                   <ShieldCheck size={14} />
                                   <span className="text-[9px] uppercase font-black tracking-widest">Admin Configured</span>
                                </div>
                                <button type="button" onClick={() => setIsRevealing(false)} className="text-[9px] uppercase font-black text-primary hover:underline">Cancel</button>
                             </div>
                             
                             <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <Input 
                                      type={showResetPassword ? "text" : "password"}
                                      placeholder="New Password"
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      className="h-10 bg-background border-primary/20 rounded-xl text-xs font-bold pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowResetPassword(!showResetPassword)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                       {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                 </div>
                                 <Button 
                                   type="button"
                                   onClick={handleReset}
                                   disabled={isRevealLoading || password.length < 6}
                                   className="h-10 px-4 rounded-xl text-[9px] uppercase font-black whitespace-nowrap"
                                 >
                                    {isRevealLoading ? '...' : 'Reset'}
                                 </Button>
                              </div>
                             {revealError && (
                                <div className="flex items-center gap-1.5 text-red-500">
                                   <AlertCircle size={10} />
                                   <span className="text-[8px] uppercase font-black tracking-widest">{revealError}</span>
                                </div>
                             )}
                          </div>
                       ) : (
                          <div className="relative group">
                             <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground opacity-40 group-focus-within:text-primary transition-colors" />
                             <Input 
                               type={showStaffPassword ? "text" : "password"} 
                               value={password} 
                               onChange={(e) => setPassword(e.target.value)} 
                               placeholder={editingUser ? "••••••••" : "MIN 6 CHARS"} 
                               className="h-12 bg-accent/20 border-border/40 rounded-xl font-bold text-sm pl-11 pr-11 transition-all" 
                               required={!editingUser} 
                               disabled={!!editingUser}
                             />
                             {!editingUser && (
                               <button
                                 type="button"
                                 onClick={() => setShowStaffPassword(!showStaffPassword)}
                                 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                               >
                                  {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                               </button>
                             )}
                          </div>
                       )}
                    </div>
                 </div>

                 <Button 
                   type="submit" 
                   disabled={isLoading || isRevealing}
                   className="w-full h-14 rounded-2xl bg-primary text-white hover:opacity-90 transition-all font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 mt-4"
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
