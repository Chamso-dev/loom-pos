import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '@/i18n'
import { useStore } from '@/store/useStore'

/** Shows a translated message and a reload button instead of a blank page if rendering fails. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LoomPOS crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const lang = useStore.getState().language
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground font-sans">
        <div role="alert" className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold">{translate(lang, 'common.crashTitle')}</h1>
          <p className="text-sm text-muted-foreground">{translate(lang, 'common.crashHint')}</p>
          <p className="text-xs text-muted-foreground break-words" dir="ltr">{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold">
            {translate(lang, 'common.reload')}
          </button>
        </div>
      </div>
    )
  }
}
