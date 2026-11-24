import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import configModule from '../data/config.js'

const { loadConfig } = configModule

const BASE = {
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/vocabdrill',
  VD_SESSION_SECRET: 'a-32-character-session-secret-value',
  VD_CREDENTIAL_SECRET: 'a-32-character-credential-secret',
  NODE_ENV: 'development',
}

function throwsWith(env, fragment) {
  assert.throws(() => loadConfig(env), (err) => {
    assert.ok(err instanceof Error, 'config errors must be Error instances')
    assert.match(err.message, new RegExp(fragment, 'i'))
    return true
  }, `expected config to reject: ${fragment}`)
}

test('development defaults are safe and usable without a configured secret', () => {
  const config = loadConfig({ NODE_ENV: 'development' })
  assert.equal(config.port, 1880)
  assert.equal(config.cookieName, 'vd_session')
  assert.equal(config.cookieSameSite, 'Lax')
  assert.equal(config.bcryptCost, 8)
  assert.equal(config.sessionTtlSeconds, 86400)
  assert.equal(config.frontendOrigin, false)
  assert.equal(config.isProduction, false)
  assert.ok(config.sessionSecret.length >= 32, 'dev must fall back to an ephemeral secret')
})

test('production requires DATABASE_URL and a long enough session secret', () => {
  throwsWith({ ...BASE, NODE_ENV: 'production', DATABASE_URL: '' }, 'DATABASE_URL')
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_SESSION_SECRET: '' }, 'VD_SESSION_SECRET')
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_SESSION_SECRET: 'too-short' }, '32')
  const config = loadConfig(BASE)
  assert.equal(config.isProduction, false)
  const prod = loadConfig({ ...BASE, NODE_ENV: 'production' })
  assert.equal(prod.isProduction, true)
  assert.equal(prod.secureCookie, true)
  assert.equal(prod.editorEnabled, false)
  assert.equal(prod.httpAdminRoot, false)
})

test('production requires a credential secret and forbids the editor', () => {
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_CREDENTIAL_SECRET: '' }, 'VD_CREDENTIAL_SECRET')
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_CREDENTIAL_SECRET: '   ' }, 'VD_CREDENTIAL_SECRET')
  throwsWith({ ...BASE, NODE_ENV: 'production', ENABLE_EDITOR: 'true' }, 'ENABLE_EDITOR')
})

test('editor is opt-in at /admin locally and takes an admin hash when provided', () => {
  const plain = loadConfig({ NODE_ENV: 'development' })
  assert.equal(plain.editorEnabled, false)
  assert.equal(plain.httpAdminRoot, false)

  const hash = bcrypt.hashSync('runtime-test-admin-password', 4)
  const editor = loadConfig({
    NODE_ENV: 'development',
    ENABLE_EDITOR: 'true',
    VD_ADMIN_USER: 'local-admin',
    VD_ADMIN_HASH: hash,
  })
  assert.equal(editor.editorEnabled, true)
  assert.equal(editor.httpAdminRoot, '/admin')
  assert.equal(editor.adminUser, 'local-admin')
  assert.equal(editor.adminHash, hash)
})

test('the editor fails closed without a valid admin hash', () => {
  throwsWith({ NODE_ENV: 'development', ENABLE_EDITOR: 'true' }, 'VD_ADMIN_HASH')
  throwsWith({ NODE_ENV: 'development', ENABLE_EDITOR: 'true', VD_ADMIN_HASH: 'not-a-hash' }, 'bcrypt')
  assert.equal(loadConfig({ NODE_ENV: 'development' }).adminHash, '')
})

test('production credential secret needs at least 32 characters', () => {
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_CREDENTIAL_SECRET: 'x' }, '32')
  assert.equal(loadConfig({ ...BASE, NODE_ENV: 'production' }).credentialSecret,
    BASE.VD_CREDENTIAL_SECRET)
})

test('Cookie SameSite, bcrypt cost and PORT are validated', () => {
  throwsWith({ ...BASE, VD_COOKIE_SAMESITE: 'Invalid' }, 'VD_COOKIE_SAMESITE')
  assert.equal(loadConfig({ ...BASE, VD_COOKIE_SAMESITE: 'none', VD_COOKIE_SECURE: 'true' }).cookieSameSite,
    'None', 'SameSite=None is valid when the cookie is Secure')
  assert.equal(loadConfig({ ...BASE, VD_COOKIE_SAMESITE: 'STRICT' }).cookieSameSite, 'Strict')
  throwsWith({ ...BASE, VD_BCRYPT_COST: '3' }, 'VD_BCRYPT_COST')
  throwsWith({ ...BASE, VD_BCRYPT_COST: '13' }, 'VD_BCRYPT_COST')
  throwsWith({ ...BASE, VD_BCRYPT_COST: 'not-a-number' }, 'VD_BCRYPT_COST')
  throwsWith({ ...BASE, PORT: '0' }, 'PORT')
  throwsWith({ ...BASE, PORT: '99999' }, 'PORT')
  assert.equal(loadConfig({ ...BASE, PORT: '4000' }).port, 4000)
})

test('VD_FRONTEND_ORIGIN must be a bare http(s) origin, never a wildcard or path', () => {
  assert.equal(loadConfig({ ...BASE, VD_FRONTEND_ORIGIN: 'http://127.0.0.1:5173' }).frontendOrigin,
    'http://127.0.0.1:5173')
  for (const bad of ['*', 'http://host/path', 'http://host/', 'https://*.example.com',
    'ftp://host', 'http://user:pass@host']) {
    throwsWith({ ...BASE, VD_FRONTEND_ORIGIN: bad }, 'VD_FRONTEND_ORIGIN')
  }
})

test('whitespace-only secrets and database URLs are rejected', () => {
  throwsWith({ ...BASE, NODE_ENV: 'production', DATABASE_URL: '   ' }, 'DATABASE_URL')
  throwsWith({ ...BASE, NODE_ENV: 'production', VD_SESSION_SECRET: ' '.repeat(40) }, 'VD_SESSION_SECRET')
})

test('SameSite=None is rejected unless the cookie is Secure', () => {
  throwsWith({ ...BASE, VD_COOKIE_SAMESITE: 'None' }, 'Secure',
    'browsers discard SameSite=None cookies without Secure')
  const config = loadConfig({ ...BASE, VD_COOKIE_SAMESITE: 'None', VD_COOKIE_SECURE: 'true' })
  assert.equal(config.cookieSameSite, 'None')
  assert.equal(config.secureCookie, true)
})

test('an explicitly configured weak secret is rejected in development too', () => {
  throwsWith({ NODE_ENV: 'development', VD_SESSION_SECRET: '   ' }, 'VD_SESSION_SECRET')
  throwsWith({ NODE_ENV: 'development', VD_SESSION_SECRET: 'short' }, '32')
  const secret = 'a-valid-development-secret-with-32plus-chars'
  const config = loadConfig({ NODE_ENV: 'development', VD_SESSION_SECRET: secret })
  assert.equal(config.sessionSecret, secret)
})
