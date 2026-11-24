import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import bcrypt from 'bcryptjs'

import configModule from '../data/config.js'
import auth from '../data/auth.js'
import { createAuthHandlers } from '../data/auth-middleware.js'

const { loadConfig } = configModule
const { dummyHash } = auth

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
  const handlers = createAuthHandlers({
    config: testConfig(overrides.env),
    pool: overrides.pool || fakePool(hash),
    dummyHashValue: dummyHash(4),
  })
  const server = http.createServer((req, res) => {
    void handlers.checkAuth(req, res, () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ next: true }))
    }).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  server.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

async function login(base, email = EMAIL, password = PASSWORD, headers = {}) {
  return fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...headers },
    body: JSON.stringify({ email, password }),
  })
}

test('health is public, other /api routes need a session, and /api/me reports the email', async () => {
  const s = await start()
  try {
    const health = await fetch(`${s.base}/api/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const next = await fetch(`${s.base}/api/anything`)
    assert.equal(next.status, 401, 'unlisted /api routes must be blocked too')

    const response = await login(s.base)
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')
    assert.ok(cookie && cookie.includes('vd_session='))

    const authed = await fetch(`${s.base}/api/me`, { headers: { cookie: cookie.split(';')[0] } })
    assert.equal(authed.status, 200)
    assert.deepEqual(await authed.json(), { ok: true, email: EMAIL })

    const token = cookie.split(';')[0].split('=')[1]
    const forged = await fetch(`${s.base}/api/me`, {
      headers: { cookie: `vd_session=${token.slice(0, -2)}zz` },
    })
    assert.equal(forged.status, 401, 'a tampered cookie must be rejected')
  } finally {
    await s.close()
  }
})

test('login cookie flags: HttpOnly, SameSite, Max-Age, no Secure over local HTTP', async () => {
  const s = await start()
  try {
    const cookie = (await login(s.base)).headers.get('set-cookie')
    assert.match(cookie, /vd_session=/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Max-Age=86400/)
    assert.doesNotMatch(cookie, /Secure/i)
  } finally {
    await s.close()
  }
})

test('production config adds the Secure flag', async () => {
  const s = await start({
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost/db',
      VD_CREDENTIAL_SECRET: 'a-32-character-credential-secret',
    },
  })
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
    for (const [email, password] of [[EMAIL, 'wrong-password'], ['nobody@example.com', PASSWORD], ['', '']]) {
      const response = await login(s.base, email, password)
      assert.equal(response.status, 401)
      assert.equal(response.headers.get('set-cookie'), null)
      assert.deepEqual(await response.json(), { error: 'unauthorized' })
    }
  } finally {
    await s.close()
  }
})

test('logout requires the CSRF header and clears the cookie', async () => {
  const s = await start()
  try {
    const noHeader = await fetch(`${s.base}/api/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(noHeader.status, 401)

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
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not-json',
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

test('wrong methods on auth endpoints return 405, while GET /api/me is valid but gated', async () => {
  const s = await start()
  try {
    for (const path of ['/api/login', '/api/logout']) {
      const response = await fetch(`${s.base}${path}`)
      assert.equal(response.status, 405, `${path} must reject GET`)
    }
    const wrongMethod = await fetch(`${s.base}/api/me`, { method: 'POST' })
    assert.equal(wrongMethod.status, 405, '/api/me must reject POST')

    const anonymous = await fetch(`${s.base}/api/me`)
    assert.equal(anonymous.status, 401, 'GET /api/me without a cookie must be unauthorized')
  } finally {
    await s.close()
  }
})

test('CORS headers appear only for the configured origin', async () => {
  const s = await start({ env: { VD_FRONTEND_ORIGIN: 'http://127.0.0.1:5173' } })
  try {
    const good = await login(s.base, EMAIL, PASSWORD, { origin: 'http://127.0.0.1:5173' })
    assert.equal(good.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
    assert.equal(good.headers.get('access-control-allow-credentials'), 'true')

    const bad = await login(s.base, EMAIL, PASSWORD, { origin: 'http://evil.example' })
    assert.equal(bad.headers.get('access-control-allow-origin'), null,
      'an unapproved origin must never receive ACAO')
  } finally {
    await s.close()
  }
})
