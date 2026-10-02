import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogIn, ShieldAlert, Loader2, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import Logo from '../ui/logo'

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { login, settings, fetchSettings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const i18n = useI18n()
  const { t } = i18n

  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const result = await login(employeeId.trim(), password)
    if (result.ok) {
      // Cashiers land on the till; the dashboard is for managers.
      const role = useStore.getState().user?.role
      navigate(role === 'ADMIN' ? from : from === '/' ? '/billing' : from, { replace: true })
    } else {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative font-sans">
      <div className="absolute top-4 end-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-[400px] px-6">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-12 h-12 rounded-lg mb-4 shadow-sm" />
          <h1 className="text-2xl font-bold tracking-tight text-center">{settings?.name || t('common.appName')}</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">{t('auth.subtitle')}</p>
        </div>

        {import.meta.env.VITE_DEMO === 'true' && (
          <p className="mb-4 rounded-md border border-border bg-accent/30 px-3 py-2 text-center text-sm text-muted-foreground">{t('auth.demoHint')}</p>
        )}
        <div className="bg-card p-8 rounded-lg border border-border shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error != null && (
              <div role="alert" className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 text-destructive">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">{i18n.error(error)}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="employeeId" className="text-sm font-medium text-muted-foreground">
                {t('auth.employeeId')}
              </label>
              <Input
                id="employeeId"
                type="text"
                dir="ltr"
                autoComplete="username"
                placeholder={t('auth.employeeIdPlaceholder')}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="h-11 bg-accent/10 text-start"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-accent/10 pe-10 text-start"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-11 font-semibold flex items-center justify-center gap-2 mt-2">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> {t('auth.loggingIn')}
                </>
              ) : (
                <>
                  <LogIn size={16} className="rtl:-scale-x-100" /> {t('auth.login')}
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
