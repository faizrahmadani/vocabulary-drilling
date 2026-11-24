/* ---------- Auth API boundary ---------- */
// Cookies are HttpOnly, so the browser sends them automatically. The custom
// header guards state-changing requests when SameSite=None is used later.
const BASE_HEADERS = {
  'content-type': 'application/json',
  'x-requested-with': 'XMLHttpRequest',
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
    const response = await fetch(path, options)
    let data = null
    try { data = await response.json() } catch { /* non-JSON response */ }
    return { ok: response.ok, status: response.status, data }
  } catch {
    // Backend down / offline: the four original screens stay usable.
    return { ok: false, status: 0, data: null, offline: true }
  }
}
