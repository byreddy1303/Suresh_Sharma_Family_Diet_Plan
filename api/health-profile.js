const { handleOptions, readJsonBody, sendError, sendJson, setCors } = require('./_lib/config');
const { assertFamilyPasscode } = require('./_lib/auth');
const { appendEntry, readProfile } = require('./_lib/store');
const { normalizeHealthEntry } = require('./_lib/health-rules');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    assertFamilyPasscode(req);
    if (req.method === 'GET') {
      const profile = await readProfile();
      sendJson(req, res, 200, { profile });
      return;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const entry = normalizeHealthEntry(body.memberId || (body.entry && body.entry.memberId), body.entry || body);
      const inserted = await appendEntry(entry);
      const profile = await readProfile();
      sendJson(req, res, 200, { entry: { ...entry, ...inserted }, profile });
      return;
    }
    setCors(req, res);
    sendError(req, res, 405, 'Use GET or POST for this endpoint.');
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not access health profile.');
  }
};
