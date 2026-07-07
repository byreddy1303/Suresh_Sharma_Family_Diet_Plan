const { getGroqConfig, handleOptions, requireMethod, sendJson } = require('./_lib/config');
const { getConfiguredPasscode } = require('./_lib/auth');
const { getDietDocument } = require('./_lib/document');
const { isDatabaseConfigured } = require('./_lib/store');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'GET')) return;

  const doc = getDietDocument();
  const config = getGroqConfig();
  sendJson(req, res, 200, {
    ok: true,
    service: 'diet-assistant',
    keyConfigured: Boolean(config.apiKey),
    dbConfigured: isDatabaseConfigured(),
    passcodeConfigured: Boolean(getConfiguredPasscode()),
    chatModel: config.chatModel,
    transcribeModel: config.transcribeModel,
    document: {
      sections: doc.sections.length,
      chunks: doc.chunks.length,
      loadedAt: doc.loadedAt
    }
  });
};
