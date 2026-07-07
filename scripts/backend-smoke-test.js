const assert = require('assert');
const { Readable } = require('stream');
const askHandler = require('../api/ask');
const transcribeHandler = require('../api/transcribe');
const { getDietDocument, retrieveContext } = require('../api/_lib/document');
const { buildSystemPrompt, buildUserPrompt } = require('../api/_lib/prompts');

const doc = getDietDocument();
assert(doc.sections.length >= 12, 'Expected the diet plan sections to load.');
assert(doc.chunks.length > doc.sections.length, 'Expected section text to be chunked.');

const payload = {
  question: 'I do not have bottle gourd today. What can I cook instead and make it tasty?',
  language: 'english',
  currentSection: { id: 's6', heading: 'Recipes' }
};
const chunks = retrieveContext(payload);
assert(chunks.length > 0, 'Expected relevant context chunks.');
assert(chunks.some(chunk => ['s6', 's12', 's7', 's1'].includes(chunk.sectionId)), 'Expected cooking or ingredient context.');

const systemPrompt = buildSystemPrompt('english');
const userPrompt = buildUserPrompt(payload, chunks);
const followUpPrompt = buildUserPrompt({
  ...payload,
  question: 'What about Amma?',
  conversation: [
    { role: 'user', content: payload.question },
    { role: 'assistant', content: 'Use ridge gourd and keep oil low.' }
  ]
}, chunks);
assert(systemPrompt.includes('No garlic'), 'Expected family cooking rule in prompt.');
assert(userPrompt.includes(payload.question), 'Expected question in user prompt.');
assert(followUpPrompt.includes('Recent conversation'), 'Expected follow-up prompt to include recent conversation.');
assert(followUpPrompt.includes('What about Amma?'), 'Expected follow-up question in prompt.');
assert(transcribeHandler.getTranscriptionHint('telugu').code === 'te', 'Telugu voice should force ISO-639-1 code te.');
assert(transcribeHandler.getTranscriptionHint('auto').code === 'te', 'Auto voice should default to Telugu to avoid Tamil misdetection.');
assert(transcribeHandler.getTranscriptionHint('english').code === 'en', 'English voice should force ISO-639-1 code en.');

function mockResponse() {
  return {
    headers: {},
    statusCode: 0,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body = '') {
      this.body = body;
    }
  };
}

async function testAskHandler() {
  const originalFetch = global.fetch;
  process.env.GROQ_API_KEY = 'test-key';
  global.fetch = async (url, options) => {
    assert(String(url).endsWith('/chat/completions'), 'Expected chat completions endpoint.');
    const body = JSON.parse(options.body);
    assert(body.max_completion_tokens === 900, 'Expected current Groq max token parameter.');
    assert(!Object.prototype.hasOwnProperty.call(body, 'max_tokens'), 'Deprecated max_tokens should not be sent.');
    assert(body.messages[0].content.includes('No garlic'), 'Expected system prompt.');
    assert(body.messages[1].content.includes('bottle gourd'), 'Expected user question in prompt.');
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Use ridge gourd or ash gourd, keep oil low, and balance dinner with dal and curd.' } }],
      model: 'mock-model',
      usage: { prompt_tokens: 100, completion_tokens: 20 }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const req = Readable.from([JSON.stringify(payload)]);
    req.method = 'POST';
    req.headers = { origin: 'http://localhost:3000' };
    const res = mockResponse();
    await askHandler(req, res);
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, 'Expected ask handler to return 200.');
    assert(body.answer.includes('ridge gourd'), 'Expected mocked answer in response.');
    assert(Array.isArray(body.followUps), 'Expected follow-up questions.');
  } finally {
    global.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
}

testAskHandler()
  .then(() => {
    console.log(JSON.stringify({
      ok: true,
      sections: doc.sections.length,
      chunks: doc.chunks.length,
      sampleContext: chunks.slice(0, 4).map(chunk => `${chunk.sectionId}:${chunk.heading}`)
    }, null, 2));
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
