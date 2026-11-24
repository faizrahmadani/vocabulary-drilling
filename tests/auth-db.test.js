import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import { createPool } from '../server/db.js'
import { verifyCredentials, newUserId } from '../server/auth.js'
import { dummyHash } from '../server/auth.js'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || ''

// Real Postgres only. Skipped unless the user supplies TEST_DATABASE_URL.
test('verifyCredentials works against a real Postgres users table',
  { skip: !TEST_DATABASE_URL, reason: 'TEST_DATABASE_URL is not configured' },
  async () => {
    const pool = createPool({ DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: 'test' })
    const email = `test-${newUserId()}@example.invalid`
    const hash = await bcrypt.hash('runtime-test-password', 4)
    try {
      await pool.query(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
        [newUserId(), email, hash],
      )
      const found = await verifyCredentials(pool, `  ${email.toUpperCase()}  `,
        'runtime-test-password', dummyHash(4))
      assert.equal(found?.email, email)
      assert.equal(await verifyCredentials(pool, email, 'wrong-password', dummyHash(4)), null)
    } finally {
      await pool.query('DELETE FROM users WHERE email = $1', [email])
      await pool.end()
    }
  })
