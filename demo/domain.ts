// The demo uses the app's own business rules.
export * from '../src/lib/domain'

/** Local calendar day as YYYY-MM-DD, like the server's dayKey. */
export const dayKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
