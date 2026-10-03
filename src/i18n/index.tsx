import { Fragment, useMemo, type ReactNode } from 'react'
import { useStore } from '@/store/useStore'
import {
  formatAlgerianPhone,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  LEGACY_METHODS,
  unitRule,
  type MoneyFormatOptions,
} from '@/lib/domain'
import { messages, type Messages } from './messages'
import type { Lang, MessageKey, PluralForms } from './define'

export type { Lang } from './define'
export type TKey = MessageKey<Messages>
export type TVars = Record<string, string | number | null | undefined>

export const LANGUAGES: Array<{ code: Lang; label: string; short: string; dir: 'rtl' | 'ltr' }> = [
  { code: 'ar', label: 'العربية', short: 'ع', dir: 'rtl' },
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
]

export const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr')

const pluralRules: Record<Lang, Intl.PluralRules> = {
  ar: new Intl.PluralRules('ar'),
  en: new Intl.PluralRules('en'),
}

/** Wraps text in a left-to-right isolate so codes, phones and numbers keep their order in Arabic lines. */
export const ltr = (text: string, lang: Lang) => (lang === 'ar' && text ? `⁦${text}⁩` : text)

function lookup(lang: Lang, key: string): string | PluralForms | undefined {
  let node: any = messages[lang]
  for (const part of key.split('.')) {
    node = node?.[part]
    if (node === undefined) return undefined
  }
  return node
}

/** Translates outside React, for example in the store. */
export function translate(lang: Lang, key: TKey | string, vars: TVars = {}): string {
  let entry = lookup(lang, key) ?? lookup('en', key)
  if (entry === undefined) {
    if (import.meta.env?.DEV) console.warn(`Missing message: ${key}`)
    return key
  }
  if (typeof entry === 'object') {
    const count = Number(vars.count ?? 0)
    const form = pluralRules[lang].select(count) as keyof PluralForms
    entry = entry[form] ?? entry.other
  }
  return (entry as string).replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name]
    if (value === undefined || value === null) return ''
    return typeof value === 'number' ? ltr(formatNumber(value), lang) : String(value)
  })
}

/** Has a message for this key, e.g. for server error codes. */
export const hasMessage = (key: string) => lookup('en', key) !== undefined

const localeOf: Record<Lang, string> = { ar: 'ar-DZ', en: 'en-GB' }

function dateFormatter(lang: Lang, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeOf[lang], { hourCycle: 'h23', ...options })
}

export function makeFormatters(lang: Lang) {
  const t = (key: TKey, vars?: TVars) => translate(lang, key, vars)
  const dates = {
    short: dateFormatter(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    medium: dateFormatter(lang, { day: 'numeric', month: 'short', year: 'numeric' }),
    long: dateFormatter(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    dayMonth: dateFormatter(lang, { weekday: 'long', day: 'numeric', month: 'long' }),
    weekday: dateFormatter(lang, { weekday: 'short' }),
    dayShort: dateFormatter(lang, { day: 'numeric', month: 'short' }),
    month: dateFormatter(lang, { month: 'long', year: 'numeric' }),
    time: dateFormatter(lang, { hour: '2-digit', minute: '2-digit' }),
  }
  const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d))

  return {
    lang,
    dir: dirOf(lang),
    t,
    /** Rich text: placeholders can be React nodes, e.g. a bold amount. */
    tx(key: TKey, vars: Record<string, ReactNode>): ReactNode {
      const text = translate(lang, key, Object.fromEntries(Object.keys(vars).map((k) => [k, `\u0000${k}\u0000`])))
      return text.split('\u0000').map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{vars[part]}</Fragment> : part))
    },
    money: (amount: number, options?: MoneyFormatOptions) => formatMoney(amount, lang, options),
    moneyShort: (amount: number) => formatMoneyShort(amount, lang),
    number: (value: number, maxDecimals = 3) => ltr(formatNumber(value, maxDecimals), lang),
    percent: (value: number) => ltr(`${formatNumber(value, 1)}%`, lang),
    /** 1.5 kg → "1,5 kg" / "1,5 كغ"; 3 pieces → "3" (or "3 pcs" with withPiece). */
    qty(quantity: number, unit: string, withPiece = false) {
      const n = ltr(formatNumber(quantity, unitRule(unit).decimals), lang)
      if (unit === 'piece' && !withPiece) return n
      return `${n} ${translate(lang, `units.short.${unit}` as TKey)}`
    },
    /** Shelf price: 250 DA/kg; pieces show the plain price. */
    unitPrice(price: number, unit: string) {
      const money = formatMoney(price, lang)
      return unit === 'piece' ? money : `${money}/${translate(lang, `units.short.${unit}` as TKey)}`
    },
    unitName: (unit: string) => translate(lang, `units.long.${unit}` as TKey),
    method(code: string) {
      const known = LEGACY_METHODS[code] ?? code
      return hasMessage(`payments.methods.${known}`) ? translate(lang, `payments.methods.${known}` as TKey) : code
    },
    phone: (phone: string | null | undefined) => ltr(formatAlgerianPhone(phone), lang),
    code: (text: string | null | undefined) => ltr(text ?? '', lang),
    date: (d: Date | string | number, style: keyof typeof dates = 'medium') => dates[style].format(toDate(d)),
    time: (d: Date | string | number) => dates.time.format(toDate(d)),
    dateTime: (d: Date | string | number) => `${dates.medium.format(toDate(d))} ${dates.time.format(toDate(d))}`,
    /** Turns an API error into a sentence for the cashier. */
    error(error: unknown) {
      const e = error as { code?: string; details?: TVars; issues?: Array<{ message?: string }> }
      const issueCode = e?.issues?.map((i) => i.message).find((m) => m && hasMessage(`errors.${m}`))
      const code = issueCode ?? e?.code
      if (code && hasMessage(`errors.${code}`)) return translate(lang, `errors.${code}` as TKey, e.details ?? {})
      return translate(lang, 'errors.GENERIC')
    },
  }
}

export type I18n = ReturnType<typeof makeFormatters>

/** The current language with translators and formatters. Re-renders when the language changes. */
export function useI18n(): I18n {
  const lang = useStore((s) => s.language)
  return useMemo(() => makeFormatters(lang), [lang])
}

/** Sets lang and dir on <html> so the whole page, portals included, flips together. */
export function applyDocumentLanguage(lang: Lang) {
  const root = document.documentElement
  root.lang = lang === 'ar' ? 'ar-DZ' : 'en'
  root.dir = dirOf(lang)
  document.title = translate(lang, 'auth.documentTitle')
}
