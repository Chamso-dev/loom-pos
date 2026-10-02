import { Languages } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LANGUAGES, useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** Two-button switch between العربية and English. Applies at once on this device. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n()
  const setLanguage = useStore((s) => s.setLanguage)

  return (
    <div
      role="group"
      aria-label={t('layout.switchLanguage')}
      className="flex items-center gap-1 rounded-md border border-border bg-accent/20 p-0.5"
    >
      {!compact && <Languages size={14} className="mx-1.5 text-muted-foreground" aria-hidden="true" />}
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={lang === l.code}
          onClick={() => setLanguage(l.code)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-semibold transition-colors',
            lang === l.code ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
