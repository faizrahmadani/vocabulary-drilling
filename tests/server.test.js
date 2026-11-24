import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import { loadConfig } from '../server/config.js'
import { createApp } from '../server/index.js'
import { dummyHash, newUserId } from '../server/auth.js'

const SECRET = 'a-32-character-session-secret-value'
const EMAIL = 'member@example.com'
const PASSWORD = 'runtime-test-password'

function testConfig(env = {}) {
  return loadConfig({
    NODE_ENV: 'development',
    VD_SESSION_SECRET: SECRET,
    VD_BCRYPT_COST: '4',
    ...env,
  })
}

function fakePool(hash) {
  return {
    async query(_sql, params) {
      if (String(params?.[0] ?? '').toLowerCase() === EMAIL) {
        return { rows: [{ id: 'user-1', email: EMAIL, password_hash: hash }] }
      }
      return { rows: [] }
    },
  }
}

async function start(overrides = {}) {
  const hash = overrides.hash || await bcrypt.hash(PASSWORD, 4)
  const app = createApp({
    config: testConfig(overrides.env),
    pool: overrides.pool || fakePool(hash),
    dummyHashValue: dummyHash(4),
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

async function login(base, email = EMAIL, password = PASSWORD) {
  return fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
    body: JSON.stringify({ email, password }),
  })
}

test('health is public and /api/me requires a valid session cookie', async () => {
  const s = await start()
  try {
    const health = await fetch(`${s.base}/api/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const anonymous = await fetch(`${s.base}/api/me`)
    assert.equal(anonymous.status, 401, 'an anonymous /api/me must be unauthorized')

    const response = await login(s.base)
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')
    assert.ok(cookie && cookie.includes('vd_session='), 'login must set the session cookie')

    const authed = await fetch(`${s.base}/api/me`, { headers: { cookie: cookie.split(';')[0] } })
    assert.equal(authed.status, 200)
    assert.deepEqual(await authed.json(), { ok: true, email: EMAIL })

    const token = cookie.split(';')[0].split('=')[1]
    const tampered = `${token.slice(0, -2)}zz`
    const forged = await fetch(`${s.base}/api/me`, { headers: { cookie: `vd_session=${tampered}` } })
    assert.equal(forged.status, 401, 'a tampered cookie must be rejected')
  } finally {
    await s.close()
  }
})

test('login sets HttpOnly, SameSite, Max-Age but no Secure over plain HTTP locally', async () => {
  const s = await start()
  try {
    const response = await login(s.base)
    const cookie = response.headers.get('set-cookie')
    assert.match(cookie, /vd_session=/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Max-Age=86400/)
    assert.doesNotMatch(cookie, /Secure/i, 'dev over http must not set Secure')
  } finally {
    await s.close()
  }
})

test('production config sets the Secure flag on the session cookie', async () => {
  const s = await start({ env: { NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost/db' } })
  try {
    const response = await login(s.base)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /Secure/i)
  } finally {
    await s.close()
  }
})

test('failed logins are generic and set no cookie', async () => {
  const s = await start()
  try {
    for (const [email, password] of [['nobody@example.com', PASSWORD], [EMAIL, 'wrong-password'], ['', '']]) {
      const response = await login(s.base, email, password)
      assert.equal(response.status, 401, `expected 401 for ${email}`)
      assert.equal(response.headers.get('set-cookie'), null)
      assert.deepEqual(await response.json(), { error: 'unauthorized' })
    }
  } finally {
    await s.close()
  }
})

test('logout needs the CSRF header and clears the cookie', async () => {
  const s = await start()
  try {
    const noHeader = await fetch(`${s.base}/api/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(noHeader.status, 401, 'logout without x-requested-with must be rejected')

    const ok = await fetch(`${s.base}/api/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      body: '{}',
    })
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get('set-cookie'), /vd_session=;/)
    assert.match(ok.headers.get('set-cookie'), /Max-Age=0/)
  } finally {
    await s.close()
  }
})

test('malformed and oversized JSON bodies fail closed', async () => {
  const s = await start()
  try {
    const malformed = await fetch(`${s.base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{definitely-not-json',
    })
    assert.equal(malformed.status, 400)

    const oversized = await fetch(`${s.base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'x'.repeat(9000) }),
    })
    assert.equal(oversized.status, 400)
  } finally {
    await s.close()
  }
})

test('wrong HTTP methods return 405 on auth endpoints', async () => {
  const s = await start()
  try {
    for (const path of ['/api/login', '/api/logout']) {
      const response = await fetch(`${s.base}${path}`)
      assert.equal(response.status, 405, `${path} must reject GET`)
    }
    const me = await fetch(`${s.base}/api/me`, { method: 'POST', body: '{}' })
    assert.equal(me.status, 405)
  } finally {
    await s.close()
  }
})

test('CORS is opt-in: explicit origin, credentials and preflight only when configured', async () => {
  const plain = await start()
  try {
    const response = await fetch(`${plain.base}/api/health`, {
      headers: { origin: 'http://127.0.0.1:5173' },
    })
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  } finally {
    await plain.close()
  }

  const configured = await start({ env: { VD_FRONTEND_ORIGIN: 'http://127.0.0.1:5173' } })
  try {
    const preflight = await fetch(`${configured.base}/api/login`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'POST',
      },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true')
    const response = await fetch(`${configured.base}/api/health`, {
      headers: { origin: 'http://evil.example' },
    })
    assert.equal(response.headers.get('access-control-allow-origin'), null,
      'an unapproved origin must not receive an ACAO header')
  } finally {
    await configured.close()
  }
})

test('a new id is generated per seed and is a UUID', () => {
  const a = newUserId()
  const b = newUserId()
  assert.notEqual(a, b)
  assert.match(a, /^[0-9a-f-]{36}$/i)
})
