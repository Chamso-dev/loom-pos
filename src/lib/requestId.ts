/**
 * An id for one attempt at a write (a sale, refund, repayment, purchase). The server records
 * a given id once, so the same request can be sent again after a lost connection without
 * selling or paying twice. Works without crypto.randomUUID (older browsers, sandboxes).
 */
export function newRequestId(prefix = 'r'): string {
  const bytes = new Uint8Array(12)
  const c = globalThis.crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}-${Date.now().toString(36)}-${hex}`
}
