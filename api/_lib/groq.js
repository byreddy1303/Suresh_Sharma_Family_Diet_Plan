const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

async function groqJson(path, apiKey, payload) {
  const response = await fetch(`${GROQ_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: timeoutSignal()
  });
  const data = await parseGroqResponse(response);
  if (!response.ok) {
    throw makeGroqError(response, data);
  }
  return data;
}

async function groqMultipart(path, apiKey, formData) {
  const response = await fetch(`${GROQ_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData,
    signal: timeoutSignal()
  });
  const data = await parseGroqResponse(response);
  if (!response.ok) {
    throw makeGroqError(response, data);
  }
  return data;
}

function timeoutSignal(ms = 25000) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

async function parseGroqResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return { text: await response.text() };
}

function makeGroqError(response, data) {
  const message =
    data && data.error && data.error.message ||
    data && data.message ||
    data && data.text ||
    `Groq request failed with HTTP ${response.status}.`;
  const error = new Error(message);
  error.statusCode = response.status >= 500 ? 502 : response.status;
  error.groqStatus = response.status;
  return error;
}

module.exports = {
  groqJson,
  groqMultipart
};
