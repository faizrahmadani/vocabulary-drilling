import test from 'node:test'
import assert from 'node:assert/strict'

import { api, apiUrl } from '../src/api.js'

const originalFetch = globalThis.fetch

function stubFetch(impl) {
  const calls = []
  globalThis.fetch = async (...args) => {
    calls.push(args)
    return impl(...args)
  }
  return calls
}

test('api sends cookies and the CSRF header on every request', async () => {
  const calls = stubFetch(async () => new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'content-type': 'application/json' },
  }))
  try {
    const result = await api('/api/me')
    assert.deepEqual(result, { ok: true, status: 200, data: { ok: true } })
    assert.equal(calls.length, 1)
    const [url, options] = calls[0]
    assert.equal(url, '/api/me')
    assert.equal(options.credentials, 'include', 'cross-origin cookies must be sent')
    assert.equal(options.headers['x-requested-with'], 'XMLHttpRequest', 'CSRF gate for logout')
    assert.equal(options.headers['content-type'], 'application/json')
    assert.equal(options.body, undefined, 'GET must not carry a body')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('api serializes POST bodies and keeps custom headers', async () => {
  const calls = stubFetch(async () => new Response('{}', { status: 200 }))
  try {
    await api('/api/login', {
      method: 'POST',
      body: { email: 'a@b.co', password: 'x' },
      headers: { 'x-extra': '1' },
    })
    const options = calls[0][1]
    assert.equal(options.method, 'POST')
    assert.equal(options.body, JSON.stringify({ email: 'a@b.co', password: 'x' }))
    assert.equal(options.headers['x-extra'], '1')
    assert.equal(options.headers['x-requested-with'], 'XMLHttpRequest')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('apiUrl prefixes the configured backend origin without doubling slashes', () => {
  assert.equal(apiUrl('/api/me'), '/api/me', 'dev uses the relative proxy path')
  assert.equal(apiUrl('/api/me', 'https://api.example.com/'),
    'https://api.example.com/api/me', 'trailing slash in the base must not double up')
})

test('api tolerates non-JSON responses (SPA fallback / proxy error)', async () => {
  stubFetch(async () => new Response('<html>not json</html>', { status: 200 }))
  try {
    const fallback = await api('/api/me')
    assert.deepEqual(fallback, { ok: true, status: 200, data: null })
  } finally {
    globalThis.fetch = originalFetch
  }

  stubFetch(async () => new Response('bad gateway', { status: 502 }))
  try {
    const gateway = await api('/api/me')
    assert.deepEqual(gateway, { ok: false, status: 502, data: null })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('api maps non-2xx and network failures without throwing', async () => {
  stubFetch(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
  try {
    assert.deepEqual(await api('/api/me'), {
      ok: false, status: 401, data: { error: 'unauthorized' },
    })
  } finally {
    globalThis.fetch = originalFetch
  }

  globalThis.fetch = async () => { throw new Error('offline') }
  try {
    const result = await api('/api/me')
    assert.equal(result.ok, false)
    assert.equal(result.status, 0)
    assert.equal(result.offline, true, 'backend-down must be distinguishable for the Member page')
  } finally {
    globalThis.fetch = originalFetch
  }
})
