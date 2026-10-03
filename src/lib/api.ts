/**
 * Fetch wrapper for the LoomPOS API. Sends the session token, parses JSON, and turns
 * error responses into ApiRequestError with the server's stable error code, which the
 * UI translates with i18n.error().
 */

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: Record<string, string | number>,
    public issues?: Array<{ message?: string; path?: Array<string | number> }>
  ) {
    super(message ?? code)
  }
}

let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

/** Called once by the store so this module stays free of store imports. */
export function configureApi(options: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = options.getToken
  onUnauthorized = options.onUnauthorized
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | string[] | null | undefined>
  /** Admin password typed by a cashier to authorise one inventory change. */
  adminKey?: string
  signal?: AbortSignal
  /** Give up after this many milliseconds (default 20 s) instead of waiting forever. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 20_000

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, adminKey, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else params.set(key, String(value))
  }
  const url = `/api${path}${params.toString() ? `?${params}` : ''}`

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (adminKey) headers['x-admin-verification-key'] = adminKey
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // A dropped connection can leave a request hanging with no answer. Stop waiting after
  // timeoutMs so the screen can say so; writes carry a requestId, so retrying is safe.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onCallerAbort = () => controller.abort()
  signal?.addEventListener('abort', onCallerAbort)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) throw new ApiRequestError(0, 'TIMEOUT', 'Server took too long to answer')
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiRequestError(0, 'NETWORK', 'Server unreachable')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const code = data?.code ?? (response.status === 401 ? 'UNAUTHORIZED' : 'GENERIC')
    if (response.status === 401 && (code === 'SESSION_EXPIRED' || code === 'UNAUTHORIZED') && token) onUnauthorized()
    throw new ApiRequestError(response.status, code, data?.error, data?.details, data?.issues)
  }
  return data as T
}
