const { handleOptions, requireMethod, sendError, sendJson } = require('./_lib/config');
const { getActivePreview, isDatabaseConfigured } = require('./_lib/store');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;

  try {
    if (!isDatabaseConfigured()) {
      sendJson(req, res, 200, { recommendations: [], appliedAt: null });
      return;
    }
    const preview = await getActivePreview();
    if (!preview) {
      sendJson(req, res, 200, { recommendations: [], appliedAt: null });
      return;
    }
    const safe = (preview.recommendations || []).map(rec => ({
      id: rec.id || null,
      personId: rec.personId || '',
      priority: rec.priority || 'medium',
      targetSectionId: rec.targetSectionId || '',
      targetSelector: rec.targetSelector || '',
      changeType: rec.changeType || '',
      currentText: rec.currentText || '',
      suggestedText: rec.suggestedText || '',
      reason: rec.reason || '',
      doctorReviewRequired: Boolean(rec.doctorReviewRequired)
    }));
    sendJson(req, res, 200, {
      recommendations: safe,
      appliedAt: preview.appliedAt || null
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not load plan adjustments.');
  }
};
