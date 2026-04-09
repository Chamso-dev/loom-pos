import { Sun, Moon, Monitor } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function ThemeToggle() {
  const { theme, setTheme } = useStore()

  const modes = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'system', icon: Monitor, label: 'System' },
  ] as const

  return (
    <div className="flex bg-accent/30 p-1 rounded-xl border border-border/40 w-full animate-in fade-in duration-500">
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = theme === mode.id

        return (
          <button
            key={mode.id}
            onClick={() => setTheme(mode.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg transition-all",
              isActive 
                ? "bg-background text-primary shadow-sm border border-border/60" 
                : "text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100"
            )}
            title={mode.label}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
