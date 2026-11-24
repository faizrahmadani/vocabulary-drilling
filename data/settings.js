'use strict';

const fs = require('fs');
const auth = require('./auth');
const db = require('./db');
const { loadConfig } = require('./config');
const { createAuthHandlers } = require('./auth-middleware');

const config = loadConfig(process.env);
const pool = db.getPool(config);
const handlers = createAuthHandlers({
  config,
  pool,
  dummyHashValue: auth.dummyHash(config.bcryptCost),
});

let adminAuth;
if (config.editorEnabled && config.adminHash) {
  adminAuth = {
    type: 'credentials',
    users: [{
      username: config.adminUser,
      password: config.adminHash,
      permissions: '*',
    }],
  };
}

module.exports = {
  uiPort: config.port,

  // flows.json lives in userDir and is the only flow source of truth.
  flowFile: config.flowFile,

  httpNodeRoot: '/api',
  httpAdminRoot: config.httpAdminRoot,
  httpStatic: fs.existsSync(config.httpStaticDir) ? config.httpStaticDir : undefined,

  // One function guards every route under /api, including not-yet-registered
  // ones. Login/logout/me are answered here before the HTTP In router.
  httpNodeAuth: handlers.checkAuth,
  httpNodeMiddleware: handlers.checkAuth,

  httpNodeCors: {
    origin: config.frontendOrigin || false,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-requested-with'],
  },

  credentialSecret: config.credentialSecret || undefined,
  adminAuth,

  editorTheme: { projects: { enabled: false } },
  logging: { console: { level: 'info', metrics: false, audit: false } },
};
