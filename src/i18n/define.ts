/**
 * Message dictionaries. Every feature keeps its English and Arabic text side by side
 * in src/i18n/messages/<feature>.ts. The Arabic half must have exactly the same keys
 * as the English half, or the app does not compile.
 */

export type Lang = 'ar' | 'en'

/** Plural forms, picked with Intl.PluralRules. Arabic uses all six; English needs one and other. */
export type PluralForms = { other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>

export type MessageTree = { readonly [key: string]: string | PluralForms | MessageTree }

/** The same keys as T, with any text as values. */
export type Translation<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends { other: string } ? PluralForms : Translation<T[K]>
}

export function defineMessages<const T extends MessageTree>(messages: { en: T; ar: Translation<T> }) {
  return messages
}

/** Dot paths to every message: "billing.title", "payments.methods.CASH"… */
export type MessageKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends { other: string }
      ? `${P}${K}`
      : MessageKey<T[K], `${P}${K}.`>
}[keyof T & string]
