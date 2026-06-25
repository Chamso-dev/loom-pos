import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserPlus, ShieldAlert, Loader2, User, KeyRound } from 'lucide-react'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register, settings, fetchSettings } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError('Please enter your full name')
    if (!/^\d{4,8}$/.test(pin)) return setError('PIN must be 4 to 8 digits')
    if (pin !== confirmPin) return setError('PINs do not match')

    setIsLoading(true)
    const result = await register(name.trim(), pin)
    if (result.success) {
      navigate('/', { replace: true })
    } else {
      setError(result.error || 'Sign up failed')
      setIsLoading(false)
    }
  }

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  const renderBrandName = () => {
    const n = settings?.name || 'LoomPOS'
    const splitIdx = n.toLowerCase().startsWith('loom') ? 4 : Math.min(4, Math.ceil(n.length / 2))
    return (
      <>
        <span className="text-primary">{n.slice(0, splitIdx)}</span>
        <span className="text-foreground">{n.slice(splitIdx)}</span>
      </>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background relative overflow-hidden font-sans pt-safe pb-safe">
      <div className="w-full max-w-[400px] px-6 relative z-10">
        <div className="flex flex-col items-center mb-8 animate-in fade-in duration-500">
          <img src="/favicon.svg" alt="Logo" className="w-12 h-12 rounded-lg mb-4 shadow-sm border border-border/40" />
          <h1 className="text-2xl font-bold tracking-tight text-center">{renderBrandName()}</h1>
          <p className="text-xs text-muted-foreground mt-1 text-center font-medium">Create your account</p>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm animate-in zoom-in-95 duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2 text-destructive">
                <ShieldAlert size={16} className="shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. Ahmed Benali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-accent/10 border-border rounded-xl pl-10 pr-3 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Create PIN (4–8 digits)</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(onlyDigits(e.target.value))}
                  className="h-12 bg-accent/10 border-border rounded-xl pl-10 pr-3 text-sm tracking-[0.3em]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">Confirm PIN</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(onlyDigits(e.target.value))}
                  className="h-12 bg-accent/10 border-border rounded-xl pl-10 pr-3 text-sm tracking-[0.3em]"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-medium flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : (<><UserPlus size={16} /> Create Account</>)}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">Log In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
