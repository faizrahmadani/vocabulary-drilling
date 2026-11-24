import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import {
  SESSION_TTL_SECONDS,
  dummyHash,
  normalizeEmail,
  verifyCredentials,
  signSession,
  parseSession,
  verifySession,
  newSession,
  newUserId,
} from '../server/auth.js'

const SECRET = 'test-secret-with-at-least-thirty-two-chars'

function fakePool(rows) {
  return {
    async query(_sql, _params) {
      return { rows }
    },
  }
}

test('normalizeEmail trims, lowercases, and tolerates non-strings', () => {
  assert.equal(normalizeEmail('  Person@Example.COM  '), 'person@example.com')
  assert.equal(normalizeEmail(null), '')
  assert.equal(normalizeEmail(undefined), '')
  assert.equal(normalizeEmail(12345), '12345')
})

test('dummyHash is a real bcrypt hash with the requested cost', () => {
  const hash = dummyHash(6)
  assert.equal(bcrypt.getRounds(hash), 6)
  assert.match(hash, /^\$2[aby]\$06\$/)
})

test('signSession/parseSession round-trip carries sub, email, iat and exp', () => {
  const now = Date.now()
  const token = signSession(
    { sub: 'user-1', email: 'user@example.com', iat: now, exp: now + SESSION_TTL_SECONDS * 1000 },
    SECRET,
  )
  const payload = parseSession(token, SECRET)
  assert.ok(payload, 'a correctly signed session must parse')
  assert.equal(payload.sub, 'user-1')
  assert.equal(payload.email, 'user@example.com')
  assert.equal(payload.iat, now)
  assert.equal(payload.exp, now + SESSION_TTL_SECONDS * 1000)
  assert.equal(verifySession(token, SECRET), true)
})

test('parseSession rejects tampered, wrong-secret, expired and malformed tokens', () => {
  const now = Date.now()
  const token = signSession(
    { sub: 'user-1', email: 'user@example.com', iat: now, exp: now + 60000 },
    SECRET,
  )
  const [encoded, mac] = token.split('.')
  const flipped = (mac[0] === 'a' ? 'b' : 'a') + mac.slice(1)

  assert.equal(parseSession(token, 'a-completely-different-secret-value-32'), null,
    'a token signed with another secret must be rejected')
  assert.equal(parseSession(`${encoded}.${flipped}`, SECRET), null,
    'a modified MAC must be rejected')
  assert.equal(parseSession(`${encoded}x.${mac}`, SECRET), null,
    'a modified payload must be rejected')
  assert.equal(parseSession('not-a-token', SECRET), null)
  assert.equal(parseSession('', SECRET), null)
  assert.equal(parseSession(null, SECRET), null)
  assert.equal(parseSession(`${encoded}.`, SECRET), null)

  const expired = signSession(
    { sub: 'user-1', email: 'user@example.com', iat: now - 120000, exp: now - 60000 },
    SECRET,
  )
  assert.equal(parseSession(expired, SECRET), null, 'an expired session must be rejected')

  const future = signSession(
    { sub: 'user-1', email: 'user@example.com', iat: now + 120000, exp: now + 200000 },
    SECRET,
  )
  assert.equal(parseSession(future, SECRET), null, 'a future iat must be rejected')

  for (const bad of [
    { email: 'user@example.com', iat: now, exp: now + 60000 },
    { sub: 'user-1', iat: now, exp: now + 60000 },
    { sub: 'user-1', email: 'user@example.com', iat: now },
    { sub: 'user-1', email: 'user@example.com', iat: now, exp: 'later' },
  ]) {
    assert.equal(parseSession(signSession(bad, SECRET), SECRET), null,
      `incomplete payload ${JSON.stringify(bad)} must be rejected`)
  }
  assert.equal(verifySession(expired, SECRET), false)
})

test('newSession stamps a finite exp and a fresh user id is a UUID', () => {
  const token = newSession('user-1', 'user@example.com', SECRET, 60)
  const payload = parseSession(token, SECRET)
  assert.ok(payload)
  assert.equal(payload.exp - payload.iat, 60000)
  assert.match(newUserId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
})

test('verifyCredentials matches a valid hash and never trusts a missing user', async () => {
  const hash = await bcrypt.hash('runtime-test-password', 4)
  const user = { id: 'user-1', email: 'user@example.com', password_hash: hash }

  const ok = await verifyCredentials(fakePool([user]), ' USER@EXAMPLE.COM ', 'runtime-test-password', dummyHash(4))
  assert.deepEqual(ok, { id: 'user-1', email: 'user@example.com' })

  const wrong = await verifyCredentials(fakePool([user]), 'user@example.com', 'wrong-password', dummyHash(4))
  assert.equal(wrong, null)

  const missing = await verifyCredentials(fakePool([]), 'nobody@example.com', 'runtime-test-password', dummyHash(4))
  assert.equal(missing, null, 'an unknown email must still return null after a bcrypt check')

  const broken = await verifyCredentials(
    fakePool([{ id: 'x', email: 'x@example.com', password_hash: 'not-a-bcrypt-hash' }]),
    'x@example.com', 'runtime-test-password', dummyHash(4),
  )
  assert.equal(broken, null, 'a corrupt stored hash must fail closed')
})
