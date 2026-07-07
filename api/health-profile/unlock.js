const { handleOptions, requireMethod, sendError, sendJson } = require('../_lib/config');
const { assertFamilyPasscode } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    assertFamilyPasscode(req);
    sendJson(req, res, 200, { ok: true });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not verify passcode.');
  }
};
