import test from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import bcrypt from 'bcryptjs'

import { readPassword, hashPassword } from '../scripts/hash-pw.mjs'
import { dummyHash } from '../server/auth.js'

test('readPassword returns the typed line without echoing it to the output', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  let captured = ''
  output.on('data', (chunk) => { captured += chunk.toString('utf8') })

  const pending = readPassword(input, output)
  input.write('swordfish\n')
  const password = await pending

  assert.equal(password, 'swordfish')
  assert.match(captured, /Password:/, 'the prompt should still be visible')
  assert.doesNotMatch(captured, /swordfish/, 'the password must never be echoed')
})

test('hashPassword produces a bcrypt hash at the configured cost', async () => {
  const hash = await hashPassword('runtime-test-password', 4)
  assert.equal(bcrypt.getRounds(hash), 4)
  assert.notEqual(hash, dummyHash(4))
})
