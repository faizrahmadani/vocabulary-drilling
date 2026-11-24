'use strict';

const auth = require('./auth');

const MAX_BODY_BYTES = 8192;
const MAX_COOKIE_BYTES = 4096;
const REQUESTED_WITH = 'xmlhttprequest';

function requestPath(req) {
  return String(req.originalUrl || req.url || '')
    .split('?')[0]
    .replace(/\/+$/, '')
    .toLowerCase();
}

function isHealthRequest(path) {
  return path === '/api/health' || path === '/health';
}

function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  return sendJson(res, 401, { error: 'unauthorized' });
}

function parseCookies(header) {
  const result = Object.create(null);
  const raw = String(header || '');
  if (raw.length > MAX_COOKIE_BYTES) return result;
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name) result[name] = part.slice(separator + 1).trim();
  }
  return result;
}

function buildCookie(config, value, maxAge) {
  const secure = config.secureCookie ? 'Secure; ' : '';
  return `${config.cookieName}=${value}; HttpOnly; ${secure}SameSite=${config.cookieSameSite}; Path=/; Max-Age=${maxAge}`;
}

function hasRequestedWith(req) {
  return String((req.headers && req.headers['x-requested-with']) || '').toLowerCase() === REQUESTED_WITH;
}

// Login/logout/me are answered here, before Node-RED's httpNodeCors router,
// so the CORS headers must be written here too. Only the configured origin matches.
function applyAuthCors(req, res, config) {
  const origin = req.headers && req.headers.origin;
  if (!config.frontendOrigin || origin !== config.frontendOrigin) return;
  res.setHeader('Access-Control-Allow-Origin', config.frontendOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-requested-with');
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let finished = false;
    const chunks = [];
    function finish(err, value) {
      if (finished) return;
      finished = true;
      if (err) reject(err);
      else resolve(value);
    }
    req.on('data', (chunk) => {
      if (finished) return;
      size += chunk.length;
      if (size > maxBytes) {
        finish(new Error('request body terlalu besar'));
        if (typeof req.resume === 'function') req.resume();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (finished) return;
      try {
        finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        finish(err);
      }
    });
    req.on('error', (err) => finish(err));
  });
}

function createAuthHandlers({ config, pool, dummyHashValue } = {}) {
  if (!config) throw new Error('config is required');
  if (!pool) throw new Error('pool is required');
  const dummy = dummyHashValue || auth.dummyHash(config.bcryptCost);

  async function handleLogin(req, res) {
    let body;
    try {
      body = await readJsonBody(req, MAX_BODY_BYTES);
    } catch (err) {
      return sendJson(res, 400, { error: 'invalid request' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return unauthorized(res);
    const email = auth.normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!email || !password) return unauthorized(res);

    try {
      const user = await auth.verifyCredentials(pool, email, password, dummy);
      if (!user) return unauthorized(res);
      const token = auth.newSession(user.id, user.email, config.sessionSecret, config.sessionTtlSeconds);
      res.setHeader('Set-Cookie', buildCookie(config, token, config.sessionTtlSeconds));
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      // Never leak connection or query details to the client.
      console.error('login database error');
      return unauthorized(res);
    }
  }

  function handleLogout(req, res) {
    // A browser processes Set-Cookie even without an old cookie (SameSite=Strict),
    // so logout always needs its own CSRF gate.
    if (!hasRequestedWith(req)) return unauthorized(res);
    if (typeof req.resume === 'function') req.resume();
    res.setHeader('Set-Cookie', buildCookie(config, '', 0));
    return sendJson(res, 200, { ok: true });
  }

  function handleMe(req, res) {
    if (typeof req.resume === 'function') req.resume();
    const cookies = parseCookies(req.headers && req.headers.cookie);
    const payload = auth.parseSession(cookies[config.cookieName], config.sessionSecret);
    if (!payload) return unauthorized(res);
    return sendJson(res, 200, { ok: true, email: payload.email });
  }

  async function checkAuth(req, res, next) {
    const method = String(req.method || '').toUpperCase();
    const path = requestPath(req);

    // Preflight must reach Node-RED's httpNodeCors router.
    if (method === 'OPTIONS') return next();
    // There are no HTTP In nodes for health, so httpNodeAuth must answer it
    // itself rather than forwarding to a router that would return 404.
    if (isHealthRequest(path)) {
      applyAuthCors(req, res, config);
      return sendJson(res, 200, { ok: true });
    }

    if (path === '/api/login' || path === '/api/logout' || path === '/api/me') {
      applyAuthCors(req, res, config);
      const allowed = path === '/api/me' ? 'GET' : 'POST';
      if (method !== allowed) return sendJson(res, 405, { error: 'method not allowed' });
      if (path === '/api/login') return handleLogin(req, res);
      if (path === '/api/logout') return handleLogout(req, res);
      return handleMe(req, res);
    }

    const cookies = parseCookies(req.headers && req.headers.cookie);
    const payload = auth.parseSession(cookies[config.cookieName], config.sessionSecret);
    if (!payload) return unauthorized(res);
    // Verified user is available to any HTTP In flow without a second DB lookup.
    req.vdUser = { id: payload.sub, email: payload.email };
    return next();
  }

  return { checkAuth, handleLogin, handleLogout, handleMe };
}

module.exports = { createAuthHandlers, MAX_BODY_BYTES, MAX_COOKIE_BYTES };
