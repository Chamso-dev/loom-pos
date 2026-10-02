/**
 * All interface text, in English and Arabic. Each feature has its own file with both
 * languages side by side; add a namespace there and register it here.
 */
import { common, errors, nav, payments, units } from './common'
import { layout } from './layout'
import { auth } from './auth'
import { billing, receipt } from './billing'
import { orders } from './orders'
import { inventory } from './inventory'
import { customers } from './customers'
import { suppliers, purchases } from './suppliers'
import { reports } from './reports'
import { settings } from './settings'
import { staff } from './staff'
import { dashboard } from './dashboard'

const namespaces = {
  common,
  nav,
  units,
  payments,
  errors,
  layout,
  auth,
  billing,
  receipt,
  orders,
  inventory,
  customers,
  suppliers,
  purchases,
  reports,
  settings,
  staff,
  dashboard,
}

type Namespaces = typeof namespaces
export type Messages = { [K in keyof Namespaces]: Namespaces[K]['en'] }

const pick = (lang: 'en' | 'ar') =>
  Object.fromEntries(Object.entries(namespaces).map(([key, value]) => [key, value[lang]])) as Messages

export const messages: Record<'en' | 'ar', Messages> = {
  en: pick('en'),
  // The Arabic dictionaries are checked against the English keys in defineMessages.
  ar: pick('ar'),
}
