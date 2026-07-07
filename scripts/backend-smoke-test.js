const assert = require('assert');
const { Readable } = require('stream');
const askHandler = require('../api/ask');
const transcribeHandler = require('../api/transcribe');
const unlockHandler = require('../api/health-profile/unlock');
const store = require('../api/_lib/store');
const { getDietDocument, retrieveContext } = require('../api/_lib/document');
const { buildSystemPrompt, buildUserPrompt } = require('../api/_lib/prompts');
const { buildRecommendations, summarizeHealthContext } = require('../api/_lib/health-rules');

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

const healthAwareSystemPrompt = buildSystemPrompt('english', { hasHealthContext: true });
assert(healthAwareSystemPrompt.includes('Never diagnose from numbers'), 'Expected reinforced no-diagnosis rule when health context is present.');

const testProfile = {
  members: [
    {
      memberId: 'suresh',
      displayName: 'Suresh',
      role: 'Father',
      latest: {
        measuredAt: '2026-07-07T08:00:00Z',
        values: { systolic: 170, diastolic: 105, weightKg: 108 },
        notes: ''
      }
    },
    {
      memberId: 'veni',
      displayName: 'Veni',
      role: 'Mother',
      latest: {
        measuredAt: '2026-07-07T08:00:00Z',
        values: { fastingGlucose: 145, weightKg: 72 },
        notes: ''
      }
    }
  ]
};

const recommendations = buildRecommendations(testProfile);
assert(recommendations.length > 0, 'Expected at least one recommendation for elevated BP + glucose.');
const sureshDoctor = recommendations.find(rec => rec.personId === 'suresh' && rec.doctorReviewRequired);
assert(sureshDoctor, 'Expected doctor-review recommendation when systolic >= 160 or diastolic >= 100.');

const summary = summarizeHealthContext(testProfile, { recommendations });
assert(summary.includes('Suresh'), 'Expected Suresh values in summary.');
assert(summary.includes('Doctor review required'), 'Expected doctor-review flag in summary.');

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

function mockRequest(method, body, headers) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method;
  req.headers = Object.assign({ origin: 'http://localhost:3000' }, headers || {});
  return req;
}

async function testPasscodeRejection() {
  process.env.FAMILY_ADMIN_PASSCODE = 'family-test-passcode';
  const wrongReq = mockRequest('POST', {}, { 'x-family-passcode': 'nope' });
  const wrongRes = mockResponse();
  await unlockHandler(wrongReq, wrongRes);
  assert(wrongRes.statusCode === 401, 'Expected wrong passcode to return 401.');

  const missingReq = mockRequest('POST', {});
  const missingRes = mockResponse();
  await unlockHandler(missingReq, missingRes);
  assert(missingRes.statusCode === 401, 'Expected missing passcode to return 401.');

  const goodReq = mockRequest('POST', {}, { 'x-family-passcode': 'family-test-passcode' });
  const goodRes = mockResponse();
  await unlockHandler(goodReq, goodRes);
  assert(goodRes.statusCode === 200, 'Expected correct passcode to return 200.');
  delete process.env.FAMILY_ADMIN_PASSCODE;
}

async function testAskHandler(healthContext) {
  const originalFetch = global.fetch;
  const originalIsDb = store.isDatabaseConfigured;
  const originalGetActive = store.getActivePreview;
  process.env.GROQ_API_KEY = 'test-key';
  store.isDatabaseConfigured = () => Boolean(healthContext);
  store.getActivePreview = async () => healthContext ? {
    profileSnapshot: testProfile,
    recommendations
  } : null;

  let sentBody = null;
  global.fetch = async (url, options) => {
    assert(String(url).endsWith('/chat/completions'), 'Expected chat completions endpoint.');
    sentBody = JSON.parse(options.body);
    assert(sentBody.max_completion_tokens === 900, 'Expected current Groq max token parameter.');
    assert(!Object.prototype.hasOwnProperty.call(sentBody, 'max_tokens'), 'Deprecated max_tokens should not be sent.');
    assert(sentBody.messages[0].content.includes('No garlic'), 'Expected system prompt.');
    assert(sentBody.messages[1].content.includes('bottle gourd'), 'Expected user question in prompt.');
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
    const req = mockRequest('POST', payload);
    const res = mockResponse();
    await askHandler(req, res);
    const body = JSON.parse(res.body);
    assert(res.statusCode === 200, 'Expected ask handler to return 200.');
    assert(body.answer.includes('ridge gourd'), 'Expected mocked answer in response.');
    assert(Array.isArray(body.followUps), 'Expected follow-up questions.');
    if (healthContext) {
      assert(body.healthContextApplied === true, 'Expected healthContextApplied to be true when preview is active.');
      assert(sentBody.messages[1].content.includes('Family health context'), 'Expected user prompt to embed family health context.');
      assert(sentBody.messages[0].content.includes('Never diagnose from numbers'), 'Expected reinforced safety rule in system prompt.');
    } else {
      assert(body.healthContextApplied === false, 'Expected healthContextApplied to be false without preview.');
      assert(!sentBody.messages[1].content.includes('Family health context'), 'Did not expect health context block without a preview.');
    }
  } finally {
    global.fetch = originalFetch;
    store.isDatabaseConfigured = originalIsDb;
    store.getActivePreview = originalGetActive;
    delete process.env.GROQ_API_KEY;
  }
}

(async () => {
  await testPasscodeRejection();
  await testAskHandler(false);
  await testAskHandler(true);
  console.log(JSON.stringify({
    ok: true,
    sections: doc.sections.length,
    chunks: doc.chunks.length,
    recommendations: recommendations.length,
    doctorReviewFlags: recommendations.filter(rec => rec.doctorReviewRequired).length,
    sampleContext: chunks.slice(0, 4).map(chunk => `${chunk.sectionId}:${chunk.heading}`)
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
