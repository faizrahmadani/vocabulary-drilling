import { randomBytes } from 'node:crypto'

const DEFAULT_PORT = 3001
const DEFAULT_TTL_SECONDS = 86400
const DEFAULT_COOKIE_NAME = 'vd_session'

function validOrigin(value) {
  if (value.endsWith('/') || value.includes('*')) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && Boolean(url.host)
      && !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash
  } catch {
    return false
  }
}

/** Fail-fast configuration. Secrets are read from the environment, never from source. */
export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production'
  const databaseUrl = String(env.DATABASE_URL || '')
  const databaseSsl = isProduction || env.DATABASE_SSL === 'true'

  const rawSecret = String(env.VD_SESSION_SECRET ?? '')
  const configuredSecret = rawSecret.trim()
  if (rawSecret && !configuredSecret) {
    throw new Error('VD_SESSION_SECRET tidak boleh hanya berisi spasi')
  }
  // An explicitly configured secret is validated in every environment: a 3-byte
  // development key makes cookie forgery trivial if the server is ever exposed.
  if (configuredSecret && configuredSecret.length < 32) {
    throw new Error('VD_SESSION_SECRET minimal 32 karakter')
  }
  // In production an ephemeral secret would invalidate every session on restart.
  const sessionSecret = configuredSecret || (isProduction ? '' : randomBytes(32).toString('hex'))

  if (isProduction && !databaseUrl.trim()) {
    throw new Error('DATABASE_URL wajib diisi saat NODE_ENV=production')
  }
  if (isProduction && !sessionSecret) {
    throw new Error('VD_SESSION_SECRET wajib diisi saat NODE_ENV=production')
  }

  const sameSiteRaw = String(env.VD_COOKIE_SAMESITE || 'Lax')
  const cookieSameSite = sameSiteRaw.charAt(0).toUpperCase() + sameSiteRaw.slice(1).toLowerCase()
  if (!['Strict', 'Lax', 'None'].includes(cookieSameSite)) {
    throw new Error('VD_COOKIE_SAMESITE hanya boleh Strict, Lax, atau None')
  }
  const secureCookie = isProduction || env.VD_COOKIE_SECURE === 'true'
  if (cookieSameSite === 'None' && !secureCookie) {
    throw new Error('SameSite=None memerlukan cookie Secure (HTTPS atau VD_COOKIE_SECURE=true)')
  }
  const bcryptCost = Number(env.VD_BCRYPT_COST || 8)
  if (!Number.isInteger(bcryptCost) || bcryptCost < 4 || bcryptCost > 12) {
    throw new Error('VD_BCRYPT_COST harus integer antara 4 dan 12')
  }

  const port = Number(env.PORT || DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT harus integer antara 1 dan 65535')
  }

  const originRaw = String(env.VD_FRONTEND_ORIGIN || '').trim()
  if (originRaw && !validOrigin(originRaw)) {
    throw new Error('VD_FRONTEND_ORIGIN harus origin http(s) tanpa wildcard, path, atau trailing slash')
  }

  return {
    port,
    databaseUrl,
    databaseSsl,
    sessionSecret,
    bcryptCost,
    cookieSameSite,
    cookieName: DEFAULT_COOKIE_NAME,
    sessionTtlSeconds: DEFAULT_TTL_SECONDS,
    frontendOrigin: originRaw || false,
    isProduction,
    secureCookie,
  }
}
