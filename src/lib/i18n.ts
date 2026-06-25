import { useStore } from '@/store/useStore'

export type Lang = 'en' | 'fr' | 'ar'

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
]

type Entry = Record<Lang, string>

/**
 * Translation table. The app is "prepared" for EN / FR / AR (Arabic is RTL).
 * Strings are added here and consumed via useT(); coverage grows incrementally.
 */
const STRINGS: Record<string, Entry> = {
  'nav.home': { en: 'Home', fr: 'Accueil', ar: 'الرئيسية' },
  'nav.stock': { en: 'Stock', fr: 'Stock', ar: 'المخزون' },
  'nav.billing': { en: 'Cart', fr: 'Panier', ar: 'السلة' },
  'nav.orders': { en: 'Orders', fr: 'Ventes', ar: 'المبيعات' },
  'nav.manage': { en: 'Manage', fr: 'Gestion', ar: 'الإدارة' },
  'nav.settings': { en: 'Settings', fr: 'Réglages', ar: 'الإعدادات' },
  'auth.welcome': {
    en: 'Welcome back. Sign in to continue.',
    fr: 'Bon retour. Connectez-vous pour continuer.',
    ar: 'مرحباً بعودتك. سجّل الدخول للمتابعة.',
  },
  'auth.create': {
    en: 'Create your account to get started.',
    fr: 'Créez votre compte pour commencer.',
    ar: 'أنشئ حسابك للبدء.',
  },
  'settings.language': { en: 'Language', fr: 'Langue', ar: 'اللغة' },
}

export function translate(key: string, lang: Lang): string {
  const entry = STRINGS[key]
  return entry ? entry[lang] : key
}

/** Hook returning a translate function bound to the current language. */
export function useT() {
  const lang = useStore((s) => s.language)
  return (key: string) => translate(key, lang)
}

/** Applies <html lang/dir> for the given language (RTL for Arabic). */
export function applyLanguageDir(lang: Lang) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}
