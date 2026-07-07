const { handleOptions, requireMethod, sendError, sendJson } = require('./_lib/config');
const { assertFamilyPasscode } = require('./_lib/auth');
const { readProfile } = require('./_lib/store');
const { buildRecommendations } = require('./_lib/health-rules');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    assertFamilyPasscode(req);
    const profile = await readProfile();
    const recommendations = buildRecommendations(profile);
    sendJson(req, res, 200, {
      profileSnapshot: profile,
      recommendations,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not build the plan preview.');
  }
};
