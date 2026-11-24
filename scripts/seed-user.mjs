#!/usr/bin/env node
/** Creates or updates the single login user. Credentials are supplied by the user. */
import { newUserId, normalizeEmail } from '../server/auth.js'
import { createPool } from '../server/db.js'

const url = String(process.env.DATABASE_URL || '')
const email = normalizeEmail(process.env.VD_SEED_EMAIL || '')
const hash = String(process.env.VD_SEED_HASH || '').trim()

if (!url.trim()) throw new Error('DATABASE_URL wajib diisi sebelum seed-user')
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error('VD_SEED_EMAIL harus berupa alamat email yang valid')
}
if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
  throw new Error('VD_SEED_HASH harus berupa hash bcrypt dari npm run hash-pw')
}

const pool = createPool({ DATABASE_URL: url, DATABASE_SSL: process.env.DATABASE_SSL })
try {
  await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [newUserId(), email, hash],
  )
  console.log(`User ${email} tersimpan.`)
} finally {
  await pool.end()
}
