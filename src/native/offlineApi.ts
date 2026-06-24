/**
 * Installs the offline API bridge on native (Capacitor) builds.
 *
 * Patches window.fetch so any request to `/api/*` is served by the on-device
 * SQLite router instead of going over the network. On the web build this is a
 * no-op, so the dev experience against the real Express backend is unchanged.
 */
import { Capacitor } from '@capacitor/core';

function extractApiPath(url: string): string | null {
  try {
    // Relative URLs resolve against the Capacitor webview origin (https://localhost).
    const parsed = new URL(url, 'https://localhost');
    return parsed.pathname.startsWith('/api/') ? parsed.pathname : null;
  } catch {
    return null;
  }
}

function headersToObject(init?: RequestInit, request?: Request): Record<string, string> {
  const result: Record<string, string> = {};
  const source = init?.headers ?? request?.headers;
  if (!source) return result;
  if (source instanceof Headers) {
    source.forEach((value, key) => (result[key.toLowerCase()] = value));
  } else if (Array.isArray(source)) {
    for (const [key, value] of source) result[key.toLowerCase()] = value;
  } else {
    for (const [key, value] of Object.entries(source)) result[key.toLowerCase()] = String(value);
  }
  return result;
}

export async function installOfflineApi(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { initDatabase } = await import('./db');
  const { handleLocalRequest } = await import('./localApi');
  await initDatabase();

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = extractApiPath(url);
    if (!path) return originalFetch(input as any, init);

    const method = (init?.method || request?.method || 'GET').toUpperCase();
    const search = new URL(url, 'https://localhost').searchParams;

    let body: any;
    const rawBody = init?.body ?? (request ? await request.clone().text() : undefined);
    if (typeof rawBody === 'string' && rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    const { status, body: responseBody } = await handleLocalRequest({
      method,
      path,
      query: search,
      body,
      headers: headersToObject(init, request),
    });

    const payload = status === 204 || responseBody == null ? null : JSON.stringify(responseBody);
    return new Response(payload, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
