#!/usr/bin/env node
/** Creates the users table. Run by the user with DATABASE_URL set (e.g. via .env). */
import db from '../data/db.js'

const { createPool } = db

const url = String(process.env.DATABASE_URL || '')
if (!url.trim()) throw new Error('DATABASE_URL wajib diisi sebelum db:migrate')

const pool = createPool({ DATABASE_URL: url, DATABASE_SSL: process.env.DATABASE_SSL })
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  console.log('Tabel users siap.')
} finally {
  await pool.end()
}
