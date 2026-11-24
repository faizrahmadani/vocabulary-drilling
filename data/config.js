'use strict';

const crypto = require('crypto');
const path = require('path');

const DEFAULT_PORT = 1880;
const DEFAULT_TTL_SECONDS = 86400;
const COOKIE_NAME = 'vd_session';

function validOrigin(value) {
  if (value.endsWith('/') || value.includes('*')) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && Boolean(url.host)
      && !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash;
  } catch (err) {
    return false;
  }
}

/** Fail-fast configuration for the Node-RED backend. */
function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const editorEnabled = env.ENABLE_EDITOR === 'true';

  const databaseUrl = String(env.DATABASE_URL || '');
  const databaseSsl = isProduction || env.DATABASE_SSL === 'true';

  const credentialSecret = String(env.VD_CREDENTIAL_SECRET || '').trim();
  if (isProduction && !credentialSecret) {
    throw new Error('VD_CREDENTIAL_SECRET wajib diisi saat NODE_ENV=production');
  }
  if (isProduction && credentialSecret && credentialSecret.length < 32) {
    throw new Error('VD_CREDENTIAL_SECRET minimal 32 karakter');
  }
  if (isProduction && editorEnabled) {
    throw new Error('ENABLE_EDITOR tidak boleh aktif di production');
  }
  const adminHash = String(env.VD_ADMIN_HASH || '').trim();
  if (editorEnabled && !adminHash) {
    throw new Error('VD_ADMIN_HASH wajib diisi saat ENABLE_EDITOR=true');
  }
  if (editorEnabled && adminHash && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminHash)) {
    throw new Error('VD_ADMIN_HASH harus berupa hash bcrypt');
  }
  if (isProduction && !databaseUrl.trim()) {
    throw new Error('DATABASE_URL wajib diisi saat NODE_ENV=production');
  }

  const rawSecret = String(env.VD_SESSION_SECRET ?? '');
  const sessionSecret = rawSecret.trim();
  if (rawSecret && !sessionSecret) {
    throw new Error('VD_SESSION_SECRET tidak boleh hanya berisi spasi');
  }
  if (sessionSecret && sessionSecret.length < 32) {
    throw new Error('VD_SESSION_SECRET minimal 32 karakter');
  }
  if (isProduction && !sessionSecret) {
    throw new Error('VD_SESSION_SECRET wajib diisi saat NODE_ENV=production');
  }
  // An ephemeral secret in dev is fine; in production it would invalidate every session on restart.
  const effectiveSecret = sessionSecret
    || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));

  const sameSiteRaw = String(env.VD_COOKIE_SAMESITE || 'Lax');
  const cookieSameSite = sameSiteRaw.charAt(0).toUpperCase() + sameSiteRaw.slice(1).toLowerCase();
  if (!['Strict', 'Lax', 'None'].includes(cookieSameSite)) {
    throw new Error('VD_COOKIE_SAMESITE hanya boleh Strict, Lax, atau None');
  }
  const secureCookie = isProduction || env.VD_COOKIE_SECURE === 'true';
  if (cookieSameSite === 'None' && !secureCookie) {
    throw new Error('SameSite=None memerlukan cookie Secure (HTTPS atau VD_COOKIE_SECURE=true)');
  }

  const bcryptCost = Number(env.VD_BCRYPT_COST || 8);
  if (!Number.isInteger(bcryptCost) || bcryptCost < 4 || bcryptCost > 12) {
    throw new Error('VD_BCRYPT_COST harus integer antara 4 dan 12');
  }

  const port = Number(env.PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT harus integer antara 1 dan 65535');
  }

  const originRaw = String(env.VD_FRONTEND_ORIGIN || '').trim();
  if (originRaw && !validOrigin(originRaw)) {
    throw new Error('VD_FRONTEND_ORIGIN harus origin http(s) tanpa wildcard, path, atau trailing slash');
  }

  return {
    port,
    databaseUrl,
    databaseSsl,
    credentialSecret,
    sessionSecret: effectiveSecret,
    bcryptCost,
    cookieName: COOKIE_NAME,
    sessionTtlSeconds: DEFAULT_TTL_SECONDS,
    cookieSameSite,
    secureCookie,
    frontendOrigin: originRaw || false,
    editorEnabled,
    httpAdminRoot: editorEnabled ? '/admin' : false,
    adminUser: String(env.VD_ADMIN_USER || 'admin'),
    adminHash,
    isProduction,
    flowFile: 'flows.json',
    httpStaticDir: path.resolve(__dirname, '..', 'dist'),
  };
}

module.exports = { loadConfig };
