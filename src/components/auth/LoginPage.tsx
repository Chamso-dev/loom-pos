import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { LogIn, ShieldAlert, Loader2, User, KeyRound, Eye, EyeOff } from 'lucide-react'
import { AuthShell, AuthField, authItem } from './AuthShell'

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login, fetchSettings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await login(employeeId, password)
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Invalid name or PIN')
      setIsLoading(false)
    }
  }

  return (
    <AuthShell subtitle="Welcome back. Sign in to continue.">
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
          label="Full Name or ID"
          icon={<User size={16} />}
          type="text"
          placeholder="Your name or ID"
          value={employeeId}
          onChange={(e) => { setEmployeeId(e.target.value); if (error) setError('') }}
          error={!!error}
          required
          autoCapitalize="none"
        />

        <AuthField
          label="PIN / Password"
          icon={<KeyRound size={16} />}
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
          error={!!error}
          required
          trailing={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-2 text-muted-foreground hover:text-foreground active:scale-90 transition-all">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <motion.div variants={authItem}>
          <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl text-sm font-semibold mt-1">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Signing in…
                </motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <LogIn size={16} /> Log In
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </form>

      <motion.p variants={authItem} className="text-center text-xs text-muted-foreground mt-7">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-primary hover:underline active:opacity-70">Create an account</Link>
      </motion.p>
    </AuthShell>
  )
}
