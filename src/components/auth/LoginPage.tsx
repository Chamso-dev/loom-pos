import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogIn, ShieldAlert, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const { login } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    const result = await login(employeeId, password)
    
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Invalid ID or Password')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[440px] px-6 relative z-10">
        <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
           <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white mb-6 shadow-xl shadow-primary/20 group hover:scale-105 transition-transform duration-500">
              <Sparkles size={32} className="group-hover:rotate-12 transition-transform" />
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-white text-center leading-tight">
              Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">LOOM POS</span>
           </h1>
           <p className="text-sm text-slate-400 mt-2 text-center">Secure terminal access for authorized personnel</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-700">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 animate-in fade-in slide-in-from-top-2">
                 <ShieldAlert size={18} className="shrink-0" />
                 <p className="text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 ml-1">Employee Identifier</label>
                  <Input 
                    type="text" 
                    placeholder="Enter your ID (e.g., admin)" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="h-12 bg-slate-950/50 border-white/5 rounded-xl px-4 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                    required
                  />
               </div>
               
               <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 ml-1">Security Keyphrase</label>
                  <div className="relative group">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 bg-slate-950/50 border-white/5 rounded-xl px-4 pr-12 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
               </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all font-semibold shadow-lg shadow-primary/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
               {isLoading ? (
                 <Loader2 className="animate-spin" size={18} />
               ) : (
                 <>
                   <LogIn size={18} />
                   Log In
                 </>
               )}
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-slate-500 opacity-60">
               Encryption Active • v2.4.0
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
