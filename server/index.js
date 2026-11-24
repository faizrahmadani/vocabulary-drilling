import express from 'express'
import { pathToFileURL } from 'node:url'

import { dummyHash, normalizeEmail, parseSession, verifyCredentials, newSession } from './auth.js'
import { closePool, getPool } from './db.js'
import { loadConfig } from './config.js'

const REQUESTED_WITH = 'xmlhttprequest'
const MAX_BODY_BYTES = 8192
const MAX_COOKIE_BYTES = 4096

function unauthorized(res) {
  return res.status(401).json({ error: 'unauthorized' })
}

function parseCookies(header) {
  const result = Object.create(null)
  const raw = String(header || '')
  if (raw.length > MAX_COOKIE_BYTES) return result
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (name) result[name] = part.slice(separator + 1).trim()
  }
  return result
}

function buildCookie(config, value, maxAge) {
  const secure = config.secureCookie ? 'Secure; ' : ''
  return `${config.cookieName}=${value}; HttpOnly; ${secure}SameSite=${config.cookieSameSite}; Path=/; Max-Age=${maxAge}`
}

function hasRequestedWith(req) {
  return String(req.get('x-requested-with') || '').toLowerCase() === REQUESTED_WITH
}

/** App factory: dependencies are injectable so tests can use a real HTTP server. */
export function createApp({ config, pool, dummyHashValue } = {}) {
  if (!config) throw new Error('config is required')
  if (!pool) throw new Error('pool is required')
  const dummy = dummyHashValue || dummyHash(config.bcryptCost)
  const app = express()

  app.use((req, res, next) => {
    const origin = req.get('origin')
    // Never emit ACAO for an unapproved origin — even though the value is fixed,
    // a browser (or proxy) may still treat a reflected header as permission.
    if (config.frontendOrigin && origin === config.frontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', config.frontendOrigin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type, x-requested-with')
      if (req.method === 'OPTIONS') return res.status(204).end()
    }
    next()
  })

  app.use(express.json({ limit: MAX_BODY_BYTES }))

  app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }))

  app.post('/api/login', async (req, res) => {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) return unauthorized(res)
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')
    if (!email || !password) return unauthorized(res)

    try {
      const user = await verifyCredentials(pool, email, password, dummy)
      if (!user) return unauthorized(res)
      const token = newSession(user.id, user.email, config.sessionSecret, config.sessionTtlSeconds)
      res.setHeader('Set-Cookie', buildCookie(config, token, config.sessionTtlSeconds))
      return res.status(200).json({ ok: true })
    } catch {
      // Never leak connection or query details to the client.
      console.error('login database error')
      return unauthorized(res)
    }
  })
  app.all('/api/login', (_req, res) => res.status(405).json({ error: 'method not allowed' }))

  app.post('/api/logout', (req, res) => {
    // The browser processes Set-Cookie even without an old cookie (SameSite=Strict),
    // so logout always needs its own CSRF gate.
    if (!hasRequestedWith(req)) return unauthorized(res)
    res.setHeader('Set-Cookie', buildCookie(config, '', 0))
    return res.status(200).json({ ok: true })
  })
  app.all('/api/logout', (_req, res) => res.status(405).json({ error: 'method not allowed' }))

  app.all('/api/me', (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
    const cookies = parseCookies(req.headers && req.headers.cookie)
    const payload = parseSession(cookies[config.cookieName], config.sessionSecret)
    if (!payload) return unauthorized(res)
    return res.status(200).json({ ok: true, email: payload.email })
  })

  app.use((err, _req, res, _next) => {
    // Malformed JSON and oversized bodies get one generic response.
    if (err) return res.status(400).json({ error: 'invalid request' })
    return res.status(404).json({ error: 'not found' })
  })

  return app
}

export function startServer(options = {}) {
  const config = options.config || loadConfig()
  const pool = options.pool || getPool(config)
  const app = createApp({ config, pool })
  const server = app.listen(config.port, () => {
    console.log(`Vocab Drill member API listening on http://127.0.0.1:${config.port}`)
  })
  const shutdown = async () => {
    await new Promise((resolve) => server.close(resolve))
    if (!options.pool) await closePool()
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { void shutdown() })
  }
  return { app, server, config, shutdown }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
