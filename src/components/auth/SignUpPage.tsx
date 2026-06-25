import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { UserPlus, ShieldAlert, Loader2, User, KeyRound, Eye, EyeOff } from 'lucide-react'
import { AuthShell, AuthField, authItem } from './AuthShell'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register, fetchSettings } = useStore()
  const navigate = useNavigate()

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Please enter your full name')
    if (!/^\d{4,8}$/.test(pin)) return setError('PIN must be 4 to 8 digits')

    setIsLoading(true)
    const result = await register(name.trim(), pin)
    if (result.success) {
      navigate('/', { replace: true })
    } else {
      setError(result.error || 'Sign up failed')
      setIsLoading(false)
    }
  }

  return (
    <AuthShell subtitle="Create your account to get started.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2 text-destructive">
                <ShieldAlert size={16} className="shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AuthField
          label="Full Name"
          icon={<User size={16} />}
          type="text"
          placeholder="e.g. Ahmed Benali"
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError('') }}
          error={!!error && !name.trim()}
          required
          autoFocus
        />

        <AuthField
          label="PIN Code (4–8 digits)"
          icon={<KeyRound size={16} />}
          type={showPin ? 'text' : 'password'}
          inputMode="numeric"
          placeholder="••••"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); if (error) setError('') }}
          error={!!error && !/^\d{4,8}$/.test(pin)}
          className="tracking-[0.3em]"
          required
          trailing={
            <button type="button" onClick={() => setShowPin((v) => !v)} className="p-2 text-muted-foreground hover:text-foreground active:scale-90 transition-all">
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <motion.p variants={authItem} className="text-[11px] text-muted-foreground/80 leading-relaxed">
          The first account created becomes the store <span className="font-semibold text-foreground/80">Admin</span>. Keep your PIN safe — it's how you sign in.
        </motion.p>

        <motion.div variants={authItem}>
          <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-sm font-semibold mt-1">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Creating account…
                </motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <UserPlus size={16} /> Create Account
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </form>

      <motion.p variants={authItem} className="text-center text-xs text-muted-foreground mt-7">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline active:opacity-70">Log In</Link>
      </motion.p>
    </AuthShell>
  )
}
