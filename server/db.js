import { Pool } from 'pg'

const DEFAULT_POOL_MAX = 2
const IDLE_TIMEOUT_MS = 10000
const CONNECT_TIMEOUT_MS = 5000

export function createPool(env = process.env) {
  const connectionString = String(env.DATABASE_URL || env.databaseUrl || '')
  const useSsl = env.NODE_ENV === 'production' || env.DATABASE_SSL === 'true' || env.databaseSsl === true
  const configuredMax = Number(env.DATABASE_POOL_MAX || DEFAULT_POOL_MAX)
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : DEFAULT_POOL_MAX

  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
    max,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  })

  // An idle client disconnecting emits 'error'; without a listener Node exits.
  pool.on('error', () => {
    console.error('db pool error')
  })
  return pool
}

let pool

export function getPool(env = process.env) {
  if (!pool) pool = createPool(env)
  return pool
}

export async function closePool() {
  if (!pool) return
  const current = pool
  pool = undefined
  await current.end()
}
