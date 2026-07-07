const { assertGroqKey, getGroqConfig, handleOptions, readJsonBody, requireMethod, sendError, sendJson } = require('./_lib/config');
const { retrieveContext } = require('./_lib/document');
const { groqJson } = require('./_lib/groq');
const { buildFollowUps, buildSystemPrompt, buildUserPrompt } = require('./_lib/prompts');

const MAX_QUESTION_CHARS = 1600;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const payload = await readJsonBody(req);
    const question = String(payload.question || '').trim();
    if (!question) {
      sendError(req, res, 400, 'Please ask a question first.');
      return;
    }
    if (question.length > MAX_QUESTION_CHARS) {
      sendError(req, res, 400, 'Please shorten the question and try again.');
      return;
    }

    const apiKey = assertGroqKey();
    const { chatModel } = getGroqConfig();
    const contextChunks = retrieveContext(payload);
    const groqPayload = {
      model: chatModel,
      messages: [
        { role: 'system', content: buildSystemPrompt(payload.language) },
        { role: 'user', content: buildUserPrompt({ ...payload, question }, contextChunks) }
      ],
      temperature: 0.35,
      max_completion_tokens: 900
    };

    const data = await groqJson('/chat/completions', apiKey, groqPayload);
    const answer = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!answer) {
      throw Object.assign(new Error('Groq returned no answer text.'), { statusCode: 502 });
    }

    sendJson(req, res, 200, {
      answer: answer.trim(),
      followUps: buildFollowUps(question),
      sources: contextChunks.map(chunk => ({
        id: chunk.id,
        sectionId: chunk.sectionId,
        heading: chunk.heading
      })),
      usage: data.usage || null,
      model: data.model || chatModel
    });
  } catch (error) {
    sendError(req, res, error.statusCode || 500, error.message || 'Could not answer the question.');
  }
};
