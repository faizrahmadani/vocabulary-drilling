import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import bcrypt from 'bcryptjs'

const ROOT = process.cwd()
const SETTINGS = path.join(ROOT, 'data', 'settings.js')
const SECRET = 'a-32-character-session-secret-value'

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function waitUntil(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        if (await predicate()) return resolve()
      } catch { /* not ready yet */ }
      if (Date.now() > deadline) return reject(new Error('timed out waiting for Node-RED'))
      setTimeout(tick, 150)
    }
    tick()
  })
}

async function start(envExtra = {}) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-nr-'))
  const port = await freePort()
  const child = spawn(process.execPath, [
    './node_modules/node-red/red.js', '--userDir', userDir, '--settings', SETTINGS,
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      VD_SESSION_SECRET: SECRET,
      VD_BCRYPT_COST: '4',
      ...envExtra,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.on('data', (chunk) => { logs += chunk.toString('utf8') })
  child.stderr.on('data', (chunk) => { logs += chunk.toString('utf8') })

  try {
    await waitUntil(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      return response.status === 200
    })
  } catch (err) {
    child.kill()
    fs.rmSync(userDir, { recursive: true, force: true })
    throw new Error(`${err.message}\n${logs}`)
  }

  return {
    base: `http://127.0.0.1:${port}`,
    logs: () => logs,
    close: async () => {
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
      fs.rmSync(userDir, { recursive: true, force: true })
    },
  }
}

test('Node-RED boots with the project settings and serves the auth API plus dist', async () => {
  const nr = await start()
  try {
    const health = await fetch(`${nr.base}/api/health`)
    assert.equal(health.status, 200, `health route must be public:\n${nr.logs()}`)
    assert.deepEqual(await health.json(), { ok: true }, 'health must be answered, not forwarded')

    for (const variant of ['/API/HEALTH/', '/api/health/']) {
      const response = await fetch(`${nr.base}${variant}`)
      assert.equal(response.status, 200, `${variant} must also be public`)
      assert.deepEqual(await response.json(), { ok: true })
    }

    const me = await fetch(`${nr.base}/api/me`)
    assert.equal(me.status, 401, '/api/me must reject an anonymous request')

    const page = await fetch(`${nr.base}/`)
    assert.equal(page.status, 200, 'httpStatic must serve the built Vue bundle at /')
    assert.match(await page.text(), /Vocab Drill/, 'the served page must be the Vue app')
  } finally {
    await nr.close()
  }
})

test('the editor is opt-in at /admin locally and requires an admin hash', async () => {
  const nr = await start({
    ENABLE_EDITOR: 'true',
    VD_ADMIN_HASH: bcrypt.hashSync('runtime-test-admin-password', 4),
  })
  try {
    const editor = await fetch(`${nr.base}/admin`)
    assert.equal(editor.status, 200, `the editor must be reachable at /admin:\n${nr.logs()}`)
    const page = await fetch(`${nr.base}/`)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Vocab Drill/, '/ must still serve the Vue app, not the editor')
  } finally {
    await nr.close()
  }
})

test('production refuses to start with the editor enabled', async () => {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-nr-prod-'))
  try {
    const child = spawn(process.execPath, [
      './node_modules/node-red/red.js', '--userDir', userDir, '--settings', SETTINGS,
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(await freePort()),
        NODE_ENV: 'production',
        ENABLE_EDITOR: 'true',
        DATABASE_URL: 'postgres://127.0.0.1:5432/unused',
        VD_SESSION_SECRET: SECRET,
        VD_CREDENTIAL_SECRET: 'a-32-character-credential-secret',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let logs = ''
    child.stdout.on('data', (c) => { logs += c.toString('utf8') })
    child.stderr.on('data', (c) => { logs += c.toString('utf8') })
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('production startup did not fail fast')) }, 15000)
      child.once('exit', (value) => { clearTimeout(timer); resolve(value) })
    })
    assert.notEqual(code, 0, `production must fail fast:\n${logs}`)
    assert.match(logs, /ENABLE_EDITOR/, `the reason must be reported:\n${logs}`)
  } finally {
    fs.rmSync(userDir, { recursive: true, force: true })
  }
})
