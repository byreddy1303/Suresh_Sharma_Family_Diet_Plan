const { handleOptions, requireMethod, sendError, sendJson } = require('../_lib/config');
const { assertFamilyPasscode } = require('../_lib/auth');
const { clearActivePreview, readProfile, setActivePreview } = require('../_lib/store');
const { buildRecommendations } = require('../_lib/health-rules');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    assertFamilyPasscode(req);
    const profile = await readProfile();
    const recommendations = buildRecommendations(profile);
    if (recommendations.length === 0) {
      await clearActivePreview();
      sendJson(req, res, 200, { applied: false, recommendations: [], profileSnapshot: profile });
      return;
    }
    await setActivePreview({ recommendations, profileSnapshot: profile });
    sendJson(req, res, 200, {
      applied: true,
      recommendations,
      profileSnapshot: profile,
      appliedAt: new Date().toISOString()
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not apply the plan preview.');
  }
};
