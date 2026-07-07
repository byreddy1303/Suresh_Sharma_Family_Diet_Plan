const crypto = require('crypto');

const PASSCODE_HEADER = 'x-family-passcode';

function getConfiguredPasscode() {
  return String(process.env.FAMILY_ADMIN_PASSCODE || '').trim();
}

function getFamilyPasscode(req) {
  const headers = req && req.headers || {};
  return String(headers[PASSCODE_HEADER] || headers['X-Family-Passcode'] || '').trim();
}

function hasFamilyPasscode(req) {
  return Boolean(getFamilyPasscode(req));
}

function isFamilyPasscodeValid(req) {
  const configured = getConfiguredPasscode();
  if (!configured) return false;
  const provided = getFamilyPasscode(req);
  if (!provided) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function assertFamilyPasscode(req) {
  const configured = getConfiguredPasscode();
  if (!configured) {
    const err = new Error('Family admin passcode is not configured in the backend environment.');
    err.statusCode = 500;
    throw err;
  }
  if (!getFamilyPasscode(req)) {
    const err = new Error('Enter the family admin passcode to access health updates.');
    err.statusCode = 401;
    throw err;
  }
  if (!isFamilyPasscodeValid(req)) {
    const err = new Error('The family admin passcode is incorrect.');
    err.statusCode = 401;
    throw err;
  }
  return true;
}

module.exports = {
  PASSCODE_HEADER,
  assertFamilyPasscode,
  getConfiguredPasscode,
  getFamilyPasscode,
  hasFamilyPasscode,
  isFamilyPasscodeValid
};
