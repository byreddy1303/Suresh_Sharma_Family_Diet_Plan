(function () {
  'use strict';

  const DOCUMENT_ID = 'suresh-sharma-family-diet-plan';
  const STORAGE_API_BASE = 'dietAssistantApiBase';
  const STORAGE_LANGUAGE = 'dietAssistantLanguage';
  const DEFAULT_ENDPOINTS = {
    ask: '/api/ask',
    transcribe: '/api/transcribe',
    health: '/api/health'
  };

  const state = {
    mediaRecorder: null,
    audioChunks: [],
    audioStream: null,
    activeRequest: null
  };

  const examples = [
    'I do not have bottle gourd today. What can I cook instead?',
    'I ate dosa instead of the planned breakfast. What should I adjust now?',
    'How do I make bitter gourd tasty without deep frying?',
    'Can Amma eat curd rice tonight if sugar is high?',
    'What is a safe evening snack for Nannagaru?'
  ];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function endpointConfig() {
    return Object.assign({}, DEFAULT_ENDPOINTS, window.DIET_ASSISTANT_ENDPOINTS || {});
  }

  function normalizeApiBase(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.replace(/\/+$/, '');
  }

  function getApiBase() {
    return normalizeApiBase(
      window.DIET_ASSISTANT_API_BASE ||
      localStorage.getItem(STORAGE_API_BASE) ||
      ''
    );
  }

  function buildUrl(path) {
    const base = getApiBase();
    if (!base) {
      throw new Error('Backend URL is not connected yet. Paste the backend URL after Claude creates it.');
    }
    if (/^https?:\/\//i.test(path)) return path;
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  function createWidget() {
    if (document.getElementById('diet-assistant-root')) return;

    const root = document.createElement('div');
    root.id = 'diet-assistant-root';
    root.className = 'diet-assistant no-print';
    root.innerHTML = `
      <button class="da-launcher" id="da-launcher" type="button" aria-controls="da-panel" aria-expanded="false">
        <span class="da-launcher-main">Ask Diet Doubts</span>
        <span class="da-launcher-sub">Text or voice question</span>
      </button>

      <section class="da-panel" id="da-panel" role="dialog" aria-label="Diet plan assistant" hidden>
        <div class="da-head">
          <div>
            <h2>Ask the Diet Plan</h2>
            <p>For substitutions, taste fixes, meal swaps, and family doubts. The API key stays only in the backend.</p>
          </div>
          <button class="da-close" id="da-close" type="button" aria-label="Close assistant">×</button>
        </div>

        <div class="da-body">
          <div class="da-setup" id="da-setup">
            <div class="da-setup-title" id="da-setup-title">Backend not connected yet</div>
            <div class="da-setup-text" id="da-setup-text">After Claude deploys the backend, paste its URL here. Example: https://your-project.vercel.app</div>
            <label class="da-field" for="da-api-base">
              Backend URL
              <input id="da-api-base" type="url" autocomplete="off" placeholder="https://your-backend.vercel.app">
            </label>
            <div class="da-row tight">
              <button class="da-btn primary" id="da-save-config" type="button">Save backend</button>
              <button class="da-btn" id="da-test-config" type="button">Test</button>
            </div>
          </div>

          <details class="da-settings">
            <summary>Assistant settings</summary>
            <div class="da-settings-body">
              <label class="da-field" for="da-language">
                Preferred answer language
                <select id="da-language">
                  <option value="auto">Auto-detect from question</option>
                  <option value="english">English</option>
                  <option value="telugu">Telugu</option>
                  <option value="hinglish">Simple Hindi + English</option>
                </select>
              </label>
              <label class="da-check">
                <input id="da-auto-ask" type="checkbox" checked>
                Ask automatically after voice transcription
              </label>
            </div>
          </details>

          <div class="da-examples" aria-label="Example questions">
            ${examples.map(example => `<button class="da-chip" type="button" data-question="${escapeAttribute(example)}">${escapeHtml(example)}</button>`).join('')}
          </div>

          <label class="da-field" for="da-question">
            Your question
            <textarea id="da-question" placeholder="Example: I do not have sorakaya today. What can I use instead and still keep it healthy?"></textarea>
          </label>

          <div class="da-row">
            <button class="da-btn mic" id="da-mic" type="button">Start voice</button>
            <button class="da-btn primary" id="da-ask" type="button">Ask</button>
            <button class="da-btn" id="da-clear" type="button">Clear</button>
          </div>

          <div class="da-transcript" id="da-transcript" hidden>
            <b>Voice transcript</b>
            <p id="da-transcript-text"></p>
          </div>

          <div class="da-status" id="da-status" role="status">Ready when the backend URL is connected.</div>

          <div class="da-answer" id="da-answer" hidden>
            <h3>Answer</h3>
            <div class="da-answer-text" id="da-answer-text"></div>
            <div class="da-followups" id="da-followups" hidden>
              <p>Try asking next</p>
              <div class="da-row tight" id="da-followup-list"></div>
            </div>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(root);
    bindWidget(root);
    loadSettings(root);
    updateConnectionState(root);
  }

  function bindWidget(root) {
    const panel = root.querySelector('#da-panel');
    const launcher = root.querySelector('#da-launcher');
    const close = root.querySelector('#da-close');
    const save = root.querySelector('#da-save-config');
    const test = root.querySelector('#da-test-config');
    const ask = root.querySelector('#da-ask');
    const mic = root.querySelector('#da-mic');
    const clear = root.querySelector('#da-clear');
    const question = root.querySelector('#da-question');
    const language = root.querySelector('#da-language');

    launcher.addEventListener('click', () => setPanelOpen(root, panel.hidden));
    close.addEventListener('click', () => setPanelOpen(root, false));
    save.addEventListener('click', () => saveConfig(root));
    test.addEventListener('click', () => testBackend(root));
    ask.addEventListener('click', () => askQuestion(root));
    mic.addEventListener('click', () => toggleVoice(root));
    clear.addEventListener('click', () => clearAssistant(root));
    language.addEventListener('change', () => localStorage.setItem(STORAGE_LANGUAGE, language.value));

    root.querySelectorAll('.da-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        question.value = chip.dataset.question || '';
        question.focus();
      });
    });

    question.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        askQuestion(root);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) setPanelOpen(root, false);
    });
  }

  function loadSettings(root) {
    root.querySelector('#da-api-base').value = getApiBase();
    root.querySelector('#da-language').value = localStorage.getItem(STORAGE_LANGUAGE) || 'auto';
  }

  function setPanelOpen(root, open) {
    const panel = root.querySelector('#da-panel');
    const launcher = root.querySelector('#da-launcher');
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      setTimeout(() => root.querySelector('#da-question').focus(), 40);
    }
  }

  function saveConfig(root) {
    const input = root.querySelector('#da-api-base');
    const value = normalizeApiBase(input.value);
    if (!value) {
      localStorage.removeItem(STORAGE_API_BASE);
      setStatus(root, 'Backend URL cleared. Paste the deployed backend URL before asking questions.', 'error');
    } else {
      localStorage.setItem(STORAGE_API_BASE, value);
      input.value = value;
      setStatus(root, 'Backend URL saved. You can test it or ask a question.', 'success');
    }
    updateConnectionState(root);
  }

  function updateConnectionState(root) {
    const setup = root.querySelector('#da-setup');
    const title = root.querySelector('#da-setup-title');
    const text = root.querySelector('#da-setup-text');
    const base = getApiBase();
    setup.classList.toggle('connected', Boolean(base));
    if (base) {
      title.textContent = 'Backend connected';
      text.textContent = base + ' will receive questions and voice audio. The Groq key must remain only in that backend.';
    } else {
      title.textContent = 'Backend not connected yet';
      text.textContent = 'After Claude deploys the backend, paste its URL here. Example: https://your-project.vercel.app';
    }
  }

  async function testBackend(root) {
    saveConfig(root);
    if (!getApiBase()) return;
    setBusy(root, true, 'Testing backend...');
    try {
      const url = buildUrl(endpointConfig().health);
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error('Health check returned ' + response.status + '. Claude can either implement /api/health or you can test by asking a question.');
      }
      setStatus(root, 'Backend health check passed.', 'success');
    } catch (error) {
      setStatus(root, error.message, 'error');
    } finally {
      setBusy(root, false);
    }
  }

  async function askQuestion(root, explicitQuestion) {
    const questionEl = root.querySelector('#da-question');
    const question = String(explicitQuestion || questionEl.value || '').trim();
    if (!question) {
      setStatus(root, 'Type a question first, or use the voice button.', 'error');
      questionEl.focus();
      return;
    }
    if (!getApiBase()) {
      setStatus(root, 'Paste and save the backend URL before asking. The static site cannot call Groq directly.', 'error');
      root.querySelector('#da-api-base').focus();
      return;
    }

    setBusy(root, true, 'Asking the diet assistant...');
    hideFollowups(root);
    try {
      const payload = buildAskPayload(root, question);
      const data = await postJson(buildUrl(endpointConfig().ask), payload);
      const answer = data.answer || data.message || data.text || '';
      if (!answer.trim()) {
        throw new Error('The backend replied, but no answer field was found.');
      }
      renderAnswer(root, answer, data);
      setStatus(root, 'Answer ready.', 'success');
    } catch (error) {
      setStatus(root, error.message, 'error');
    } finally {
      setBusy(root, false);
    }
  }

  function buildAskPayload(root, question) {
    const activeSection = getActiveSection();
    return {
      documentId: DOCUMENT_ID,
      question,
      language: root.querySelector('#da-language').value,
      sourceUrl: location.href,
      pageTitle: document.title,
      selectedText: getSelectedText(),
      currentSection: activeSection,
      answerMode: 'practical_family_diet_assistant',
      userIntentExamples: [
        'ingredient substitution',
        'taste improvement',
        'meal swap recovery',
        'portion doubt',
        'voice question from parent'
      ],
      safety: {
        doNotDiagnose: true,
        doNotChangeMedication: true,
        adviseDoctorForSymptomsOrMedicalRisk: true,
        useDietPlanAsPrimaryReference: true
      }
    };
  }

  async function toggleVoice(root) {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      state.mediaRecorder.stop();
      return;
    }
    if (!getApiBase()) {
      setStatus(root, 'Connect the backend URL before recording voice. The audio must go to the backend for transcription.', 'error');
      root.querySelector('#da-api-base').focus();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setStatus(root, 'This browser does not support voice recording. Please type the question instead.', 'error');
      return;
    }

    try {
      state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseAudioMimeType();
      state.audioChunks = [];
      state.mediaRecorder = new MediaRecorder(state.audioStream, mimeType ? { mimeType } : undefined);
      state.mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data && event.data.size > 0) state.audioChunks.push(event.data);
      });
      state.mediaRecorder.addEventListener('stop', () => finishVoice(root, mimeType));
      state.mediaRecorder.start();
      root.querySelector('#da-mic').textContent = 'Stop voice';
      root.querySelector('#da-mic').classList.add('recording');
      setStatus(root, 'Recording... press Stop voice when finished.');
    } catch (error) {
      cleanupRecording(root);
      setStatus(root, 'Could not start microphone: ' + error.message, 'error');
    }
  }

  function chooseAudioMimeType() {
    const options = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg'
    ];
    return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function finishVoice(root, mimeType) {
    const blob = new Blob(state.audioChunks, { type: mimeType || 'audio/webm' });
    cleanupRecording(root);
    if (!blob.size) {
      setStatus(root, 'No audio was captured. Please try again.', 'error');
      return;
    }
    setBusy(root, true, 'Transcribing voice...');
    try {
      const data = await transcribeAudio(root, blob);
      const transcript = String(data.transcript || data.text || '').trim();
      if (!transcript) {
        throw new Error('The backend returned no transcript.');
      }
      showTranscript(root, transcript);
      root.querySelector('#da-question').value = transcript;
      setStatus(root, 'Voice transcribed.', 'success');
      if (root.querySelector('#da-auto-ask').checked) {
        await askQuestion(root, transcript);
      }
    } catch (error) {
      setStatus(root, error.message, 'error');
    } finally {
      setBusy(root, false);
    }
  }

  async function transcribeAudio(root, blob) {
    const form = new FormData();
    form.append('audio', blob, 'diet-question.webm');
    form.append('documentId', DOCUMENT_ID);
    form.append('language', root.querySelector('#da-language').value);
    form.append('sourceUrl', location.href);

    const response = await fetch(buildUrl(endpointConfig().transcribe), {
      method: 'POST',
      body: form
    });
    return parseResponse(response);
  }

  function cleanupRecording(root) {
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(track => track.stop());
    }
    state.audioStream = null;
    state.mediaRecorder = null;
    state.audioChunks = [];
    const mic = root.querySelector('#da-mic');
    mic.textContent = 'Start voice';
    mic.classList.remove('recording');
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : { text: await response.text() };
    if (!response.ok) {
      const message = data.error && data.error.message ? data.error.message : data.message || data.text || ('Request failed with ' + response.status);
      throw new Error(message);
    }
    return data;
  }

  function renderAnswer(root, answer, data) {
    const box = root.querySelector('#da-answer');
    const text = root.querySelector('#da-answer-text');
    box.hidden = false;
    text.textContent = answer.trim();
    renderFollowups(root, data.followUps || data.followups || data.suggestedQuestions || []);
  }

  function renderFollowups(root, followUps) {
    const wrap = root.querySelector('#da-followups');
    const list = root.querySelector('#da-followup-list');
    list.innerHTML = '';
    if (!Array.isArray(followUps) || followUps.length === 0) {
      wrap.hidden = true;
      return;
    }
    followUps.slice(0, 3).forEach(item => {
      const question = String(item || '').trim();
      if (!question) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'da-chip';
      chip.textContent = question;
      chip.addEventListener('click', () => {
        root.querySelector('#da-question').value = question;
        askQuestion(root, question);
      });
      list.appendChild(chip);
    });
    wrap.hidden = list.children.length === 0;
  }

  function hideFollowups(root) {
    root.querySelector('#da-followups').hidden = true;
    root.querySelector('#da-followup-list').innerHTML = '';
  }

  function showTranscript(root, transcript) {
    const box = root.querySelector('#da-transcript');
    root.querySelector('#da-transcript-text').textContent = transcript;
    box.hidden = false;
  }

  function clearAssistant(root) {
    root.querySelector('#da-question').value = '';
    root.querySelector('#da-answer').hidden = true;
    root.querySelector('#da-answer-text').textContent = '';
    root.querySelector('#da-transcript').hidden = true;
    root.querySelector('#da-transcript-text').textContent = '';
    hideFollowups(root);
    setStatus(root, getApiBase() ? 'Ready.' : 'Ready when the backend URL is connected.');
  }

  function setStatus(root, message, type) {
    const status = root.querySelector('#da-status');
    status.textContent = message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function setBusy(root, busy, message) {
    root.querySelector('#da-ask').disabled = busy;
    root.querySelector('#da-test-config').disabled = busy;
    root.querySelector('#da-save-config').disabled = busy;
    if (message) setStatus(root, message);
  }

  function getSelectedText() {
    const selection = window.getSelection ? window.getSelection().toString().trim() : '';
    return selection.slice(0, 1800);
  }

  function getActiveSection() {
    let section = null;
    if (location.hash) {
      section = document.querySelector(location.hash);
    }
    if (!section) {
      const sections = Array.from(document.querySelectorAll('main .section'));
      section = sections.find(item => {
        const rect = item.getBoundingClientRect();
        return rect.top <= window.innerHeight * 0.42 && rect.bottom >= window.innerHeight * 0.25;
      }) || sections[0] || null;
    }
    if (!section) return null;
    const heading = section.querySelector('.section-header h2');
    return {
      id: section.id || '',
      heading: heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '',
      textPreview: section.textContent.replace(/\s+/g, ' ').trim().slice(0, 4200)
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  ready(createWidget);
})();
