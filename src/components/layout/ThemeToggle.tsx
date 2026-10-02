import { Sun, Moon, Monitor } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export default function ThemeToggle() {
  const { theme, setTheme } = useStore()
  const { t } = useI18n()

  const modes = [
    { id: 'light', icon: Sun },
    { id: 'dark', icon: Moon },
    { id: 'system', icon: Monitor },
  ] as const

  return (
    <div className="flex bg-accent/30 p-1 rounded-xl border border-border/40 w-full">
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = theme === mode.id
        const label = t(`nav.theme.${mode.id}`)
        return (
          <button
            key={mode.id}
            onClick={() => setTheme(mode.id)}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg transition-all',
              isActive
                ? 'bg-background text-primary shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100'
            )}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
