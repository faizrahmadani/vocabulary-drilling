import crypto, { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

export const SESSION_TTL_SECONDS = 86400

const MAX_COOKIE_BYTES = 4096

/** A bcrypt hash of a random value, used when an email is unknown so timing stays flat. */
export function dummyHash(cost) {
  return bcrypt.hashSync(randomUUID(), cost)
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export async function findUserByEmail(pool, email) {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
    [normalizeEmail(email)],
  )
  return result.rows[0] || null
}

/** Always runs a bcrypt comparison — including for unknown users — to avoid enumeration. */
export async function verifyCredentials(pool, email, password, dummyHashValue) {
  const user = await findUserByEmail(pool, email)
  const hash = user ? user.password_hash : dummyHashValue
  let matches = false
  try {
    matches = await bcrypt.compare(String(password || ''), hash)
  } catch {
    matches = false
  }
  if (!user || !matches) return null
  return { id: user.id, email: user.email }
}

export function signSession(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const mac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${mac}`
}

/** Returns the signed payload, or null for any malformed, forged or expired token. */
export function parseSession(token, secret) {
  if (typeof token !== 'string' || !token || token.length > MAX_COOKIE_BYTES) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  const [encoded, suppliedMac] = parts
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest()
  const supplied = Buffer.from(suppliedMac, 'base64url')
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  if (typeof payload.sub !== 'string' || !payload.sub) return null
  if (typeof payload.email !== 'string' || !payload.email) return null

  const now = Date.now()
  if (!Number.isFinite(payload.exp) || payload.exp <= now) return null
  if (!Number.isFinite(payload.iat) || payload.iat > now + 60000) return null
  return payload
}

export function verifySession(token, secret) {
  return parseSession(token, secret) !== null
}

export function newSession(userId, email, secret, ttlSeconds = SESSION_TTL_SECONDS) {
  const now = Date.now()
  return signSession({ sub: userId, email, iat: now, exp: now + ttlSeconds * 1000 }, secret)
}

export function newUserId() {
  return randomUUID()
}
