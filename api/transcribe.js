const { assertGroqKey, getGroqConfig, handleOptions, requireMethod, sendError, sendJson } = require('./_lib/config');
const { groqMultipart } = require('./_lib/groq');
const { readMultipart } = require('./_lib/multipart');

async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const apiKey = assertGroqKey();
    const { transcribeModel } = getGroqConfig();
    const { fields, files } = await readMultipart(req);
    const audio = files.audio;

    if (!audio || !audio.buffer || !audio.buffer.length) {
      sendError(req, res, 400, 'No voice audio was received.');
      return;
    }

    const form = new FormData();
    const blob = new Blob([audio.buffer], { type: audio.contentType || 'audio/webm' });
    form.append('file', blob, audio.filename || 'diet-question.webm');
    form.append('model', transcribeModel);
    form.append('response_format', 'json');
    if (fields.language === 'english') {
      form.append('language', 'en');
    }

    const data = await groqMultipart('/audio/transcriptions', apiKey, form);
    const transcript = String(data.text || data.transcript || '').trim();
    if (!transcript) {
      throw Object.assign(new Error('Groq returned no transcript text.'), { statusCode: 502 });
    }

    sendJson(req, res, 200, {
      transcript,
      language: fields.language || 'auto',
      model: transcribeModel
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not transcribe the audio.');
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
