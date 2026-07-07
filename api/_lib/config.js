const DEFAULT_ALLOWED_ORIGIN = 'https://byreddy1303.github.io';
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (LOCAL_ORIGIN_RE.test(origin)) return true;
  return getAllowedOrigins().includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = isAllowedOrigin(origin) ? origin : '';
  res.setHeader('Access-Control-Allow-Origin', allowed || getAllowedOrigins()[0] || DEFAULT_ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Family-Passcode');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function handleOptions(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function sendJson(req, res, statusCode, payload) {
  setCors(req, res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendError(req, res, statusCode, message, details) {
  const body = { error: { message } };
  if (details && process.env.NODE_ENV !== 'production') {
    body.error.details = details;
  }
  sendJson(req, res, statusCode, body);
}

function requireMethod(req, res, method) {
  if (req.method === method) return true;
  sendError(req, res, 405, `Use ${method} for this endpoint.`);
  return false;
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBytes) {
      const err = new Error('Request body is too large.');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error('Request body must be valid JSON.');
    err.statusCode = 400;
    throw err;
  }
}

function getGroqConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY || '',
    chatModel: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
    transcribeModel: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo'
  };
}

function assertGroqKey() {
  const { apiKey } = getGroqConfig();
  if (!apiKey) {
    const err = new Error('Backend is deployed, but GROQ_API_KEY is not configured in the backend environment.');
    err.statusCode = 500;
    throw err;
  }
  return apiKey;
}

module.exports = {
  DEFAULT_ALLOWED_ORIGIN,
  assertGroqKey,
  getAllowedOrigins,
  getGroqConfig,
  handleOptions,
  readJsonBody,
  requireMethod,
  sendError,
  sendJson,
  setCors
};
