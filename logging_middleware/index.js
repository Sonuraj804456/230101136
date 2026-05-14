const fs = require('fs');
const path = require('path');
const axios = require('axios');

const logFolder = path.join(__dirname, 'logs');
const requestLogPath = path.join(logFolder, 'request.log');
const errorLogPath = path.join(logFolder, 'error.log');
const LOG_API_URL = process.env.LOG_API_URL || 'http://4.224.186.213/evaluation-service/logs';
const AUTH_TOKEN = process.env.NOTIFICATION_API_TOKEN || process.env.LOG_API_TOKEN || '';

const validStacks = new Set(['backend', 'frontend']);
const validLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const validPackages = new Set(['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service', 'api', 'component', 'hook', 'page', 'state', 'style', 'auth', 'config', 'middleware', 'utils']);

function ensureLogFolder() {
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true });
  }
}

function appendLog(filePath, entry) {
  ensureLogFolder();
  fs.appendFileSync(filePath, `${entry}\n`, 'utf8');
}

function validateLogParams(stack, level, packageName) {
  if (!validStacks.has(stack)) {
    throw new Error(`Invalid stack value: ${stack}`);
  }
  if (!validLevels.has(level)) {
    throw new Error(`Invalid level value: ${level}`);
  }
  if (!validPackages.has(packageName)) {
    throw new Error(`Invalid package value: ${packageName}`);
  }
}

async function postLog(payload) {
  if (!AUTH_TOKEN) {
    return;
  }

  try {
    await axios.post(LOG_API_URL, payload, {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    appendLog(errorLogPath, JSON.stringify({ timestamp, level: 'error', message: 'Remote log failed', meta: { error: error.message, payload } }));
  }
}

function logEvent(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const payload = JSON.stringify({ timestamp, level, message, meta });
  appendLog(level === 'error' ? errorLogPath : requestLogPath, payload);
  if (process.env.NODE_ENV !== 'production') {
    console.log(payload);
  }
}

function Log(stack, level, packageName, message) {
  validateLogParams(stack, level, packageName);

  const payload = {
    stack,
    level,
    package: packageName,
    message,
  };

  logEvent(level === 'error' ? 'error' : 'info', message, { stack, package: packageName, payload });
  postLog(payload).catch(() => {});
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `HTTP ${req.method} ${req.originalUrl} ${res.statusCode}`;
    Log('backend', 'info', 'route', `${message} - ${duration}ms`);
    logEvent('info', 'HTTP request completed', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  });
  next();
}

function errorLogger(err, req, res, next) {
  const message = err.message || 'Unhandled error';
  Log('backend', 'error', 'handler', `${message} at ${req.method} ${req.originalUrl}`);
  logEvent('error', err.message || 'Unhandled error', {
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    status: res.statusCode,
  });
  next(err);
}

module.exports = {
  requestLogger,
  errorLogger,
  logEvent,
  Log,
};
