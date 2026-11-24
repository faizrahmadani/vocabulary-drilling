'use strict';

const { Pool } = require('pg');

const DEFAULT_POOL_MAX = 2;
const IDLE_TIMEOUT_MS = 10000;
const CONNECT_TIMEOUT_MS = 5000;

function createPool(env = process.env) {
  const connectionString = String(env.DATABASE_URL || env.databaseUrl || '');
  const useSsl = env.NODE_ENV === 'production' || env.DATABASE_SSL === 'true' || env.databaseSsl === true;
  const configuredMax = Number(env.DATABASE_POOL_MAX || DEFAULT_POOL_MAX);
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : DEFAULT_POOL_MAX;

  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
    max,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  pool.on('error', () => {
    console.error('db pool error');
  });
  return pool;
}

let pool;

function getPool(env = process.env) {
  if (!pool) pool = createPool(env);
  return pool;
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}

module.exports = { createPool, getPool, closePool };
