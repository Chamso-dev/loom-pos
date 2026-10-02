import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Input } from '@/components/ui/input'
import { LogIn, ShieldAlert, Loader2, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/i18n'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import Logo from '../ui/logo'

/** Current time, refreshed every 15 seconds for the clock on the shop panel. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}

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
  const now = useNow()

  const from = location.state?.from?.pathname || '/'
  const shopName = settings?.name || t('common.appName')

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
    <div className="min-h-[100dvh] w-full grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] bg-background font-sans">
      {/* The shop: its name, today's date and the time, on the shop blue. */}
      <section className="relative overflow-hidden bg-brand text-brand-foreground flex flex-col gap-6 px-5 pt-5 pb-6 sm:gap-10 sm:px-10 sm:pt-8 sm:pb-8 lg:p-12">
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -end-24 w-[22rem] opacity-[0.08] sm:w-[28rem] lg:-bottom-32 lg:-end-32 lg:w-[40rem] rtl:-scale-x-100"
        >
          <path d="M9 8h3.5v10.5a1.5 1.5 0 001.5 1.5H23v3.5H14A5.5 5.5 0 018.5 18V8z" fill="currentColor" />
          <rect x="14" y="8" width="9" height="7" rx="1" fill="currentColor" />
        </svg>

        <div className="relative flex items-center gap-2.5">
          <Logo className="w-8 h-8 rounded-md" />
          <span className="text-sm font-semibold">{t('common.appName')}</span>
        </div>

        <div className="relative lg:mt-auto">
          <p className="font-display text-base sm:text-lg font-medium text-brand-foreground/80">{i18n.date(now, 'dayMonth')}</p>
          {/* bdi keeps a Latin shop name in order while it still lines up with the page direction. */}
          <h1 className="mt-2 font-display font-extrabold leading-[0.95] tracking-tight text-[clamp(2rem,7vw,4.75rem)] break-words">
            <bdi>{shopName}</bdi>
          </h1>
          {settings?.address && (
            <p className="mt-4 max-w-md text-base text-brand-foreground/80 max-sm:hidden">
              <bdi>{settings.address}</bdi>
            </p>
          )}
        </div>

        <p className="relative hidden lg:block font-display text-3xl font-semibold tabular-nums">
          {i18n.time(now)}
        </p>
      </section>

      {/* Sign-in */}
      <main className="relative flex flex-col justify-center px-5 py-8 sm:py-10 sm:px-10">
        <div className="absolute top-4 end-4 sm:top-6 sm:end-6">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm mx-auto mt-6 sm:mt-8 lg:mt-0">
          <h2 className="text-2xl font-bold">{t('auth.subtitle')}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('auth.formHint')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error != null && (
              <div role="alert" className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 text-destructive">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">{i18n.error(error)}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="employeeId" className="text-sm font-medium">
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
                className="h-12 text-base text-start"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
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
                  className="h-12 text-base pe-11 text-start"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-md bg-brand text-brand-foreground font-semibold flex items-center justify-center gap-2 hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-60 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> {t('auth.loggingIn')}
                </>
              ) : (
                <>
                  <LogIn size={18} className="rtl:-scale-x-100" /> {t('auth.login')}
                </>
              )}
            </button>
          </form>

          {import.meta.env.VITE_DEMO === 'true' && (
            <p className="mt-6 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">{t('auth.demoHint')}</p>
          )}
        </div>
      </main>
    </div>
  )
}
