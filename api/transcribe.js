const { assertGroqKey, getGroqConfig, handleOptions, requireMethod, sendError, sendJson } = require('./_lib/config');
const { groqMultipart } = require('./_lib/groq');
const { readMultipart } = require('./_lib/multipart');

const TRANSCRIPTION_HINTS = {
  auto: {
    code: 'te',
    prompt: 'ఇది తెలుగు కుటుంబ ఆహార ప్రణాళిక ప్రశ్న. పదాలు: సొరకాయ, బీరకాయ, కాకరకాయ, పప్పు, అన్నం, దోశ, ఇడ్లీ, సాంబార్, అమ్మగారు, నాన్నగారు.'
  },
  telugu: {
    code: 'te',
    prompt: 'ఇది తెలుగు కుటుంబ ఆహార ప్రణాళిక ప్రశ్న. పదాలు: సొరకాయ, బీరకాయ, కాకరకాయ, పప్పు, అన్నం, దోశ, ఇడ్లీ, సాంబార్, అమ్మగారు, నాన్నగారు.'
  },
  english: {
    code: 'en',
    prompt: 'This is an English family diet plan question about meals, substitutions, recipes, and ingredients.'
  },
  hinglish: {
    code: 'hi',
    prompt: 'Yeh Hindi aur English mixed family diet plan question hai. Khana, recipe, substitution, dosa, idli, dal, rice, sambar.'
  }
};

function getTranscriptionHint(language) {
  const key = String(language || 'auto').toLowerCase();
  return TRANSCRIPTION_HINTS[key] || TRANSCRIPTION_HINTS.auto;
}

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
    const hint = getTranscriptionHint(fields.language);
    form.append('file', blob, audio.filename || 'diet-question.webm');
    form.append('model', transcribeModel);
    form.append('response_format', 'json');
    form.append('language', hint.code);
    form.append('prompt', hint.prompt);
    form.append('temperature', '0');

    const data = await groqMultipart('/audio/transcriptions', apiKey, form);
    const transcript = String(data.text || data.transcript || '').trim();
    if (!transcript) {
      throw Object.assign(new Error('Groq returned no transcript text.'), { statusCode: 502 });
    }

    sendJson(req, res, 200, {
      transcript,
      language: fields.language || 'auto',
      languageHint: hint.code,
      model: transcribeModel
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not transcribe the audio.');
  }
}

module.exports = handler;
module.exports.getTranscriptionHint = getTranscriptionHint;
module.exports.config = {
  api: {
    bodyParser: false
  }
};
