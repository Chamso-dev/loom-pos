import React, { useState, useEffect } from 'react'
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
  
  const { login, settings, fetchSettings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

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

  const renderBrandName = () => {
    const name = settings?.name || 'LoomPOS'
    const firstSpace = name.indexOf(' ')
    if (firstSpace !== -1) {
      return (
        <>
          <span className="text-primary">{name.slice(0, firstSpace)}</span>
          <span className="text-foreground">{name.slice(firstSpace)}</span>
        </>
      )
    }
    const splitIdx = name.toLowerCase().startsWith('loom') ? 4 : Math.min(4, Math.ceil(name.length / 2))
    return (
      <>
        <span className="text-primary">{name.slice(0, splitIdx)}</span>
        <span className="text-foreground">{name.slice(splitIdx)}</span>
      </>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden font-sans pt-safe pb-safe">
      <div className="w-full max-w-[400px] px-6 relative z-10">
        <div className="flex flex-col items-center mb-8 animate-in fade-in duration-500">
           <img src="/favicon.svg" alt="LoomPOS Logo" className="w-12 h-12 rounded-lg mb-4 shadow-sm border border-border/40" />
           <h1 className="text-2xl font-bold tracking-tight text-center">
              {renderBrandName()}
           </h1>
           <p className="text-xs text-muted-foreground mt-1 text-center font-medium">Authorized personnel access only</p>
        </div>

        <div className="bg-card p-8 rounded-lg border border-border shadow-sm animate-in zoom-in-98 duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                 <ShieldAlert size={16} className="shrink-0" />
                 <p className="text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-3">
               <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Employee Identifier</label>
                  <Input 
                    type="text" 
                    placeholder="Enter your ID (e.g., admin)" 
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="h-10 bg-accent/10 border-border rounded-md px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    required
                  />
               </div>
               
               <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Security Keyphrase</label>
                  <div className="relative group">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 bg-accent/10 border-border rounded-md px-3 pr-10 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
               </div>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground hover:opacity-90 font-medium active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
               {isLoading ? (
                 <Loader2 className="animate-spin" size={16} />
               ) : (
                 <>
                   <LogIn size={16} />
                   Log In
                 </>
               )}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="w-full h-px bg-border"></div>
            <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground opacity-60">
               Encryption Active
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
