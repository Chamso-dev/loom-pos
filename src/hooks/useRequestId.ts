import { useMemo } from 'react'
import { newRequestId } from '@/lib/requestId'

/**
 * One request id per distinct form content: sending the same form again (for example after a
 * lost connection) reuses the id, so the server records it once; changing the form or calling
 * `renew` after a success gives a new id.
 */
export function useRequestId(prefix: string, content: unknown, generation = 0) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => newRequestId(prefix), [prefix, JSON.stringify(content), generation])
}
