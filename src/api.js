/* ---------- Auth API boundary ---------- */
// Cookies are HttpOnly, so the browser sends them automatically. The custom
// header guards state-changing requests when SameSite=None is used later.
const BASE_HEADERS = {
  'content-type': 'application/json',
  'x-requested-with': 'XMLHttpRequest',
}

// Dev/preview: empty → the Vite proxy handles /api same-origin.
// Production: set VITE_API_BASE to the backend origin (a public URL, not a secret).
const API_BASE = import.meta.env?.VITE_API_BASE || ''

export function apiUrl(path, base = API_BASE) {
  return base ? `${String(base).replace(/\/+$/, '')}${path}` : path
}

export async function api(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
  const options = {
    ...rest,
    method,
    credentials: 'include',
    headers: { ...BASE_HEADERS, ...headers },
  }
  if (body !== undefined) options.body = JSON.stringify(body)

  try {
    const response = await fetch(apiUrl(path), options)
    let data = null
    try { data = await response.json() } catch { /* non-JSON response */ }
    return { ok: response.ok, status: response.status, data }
  } catch {
    // Backend down / offline: the four original screens stay usable.
    return { ok: false, status: 0, data: null, offline: true }
  }
}
