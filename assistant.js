(function () {
  'use strict';

  const DOCUMENT_ID = 'suresh-sharma-family-diet-plan';
  const DEFAULT_API_BASE = 'https://suresh-sharma-family-diet-plan.vercel.app';
  const STORAGE_API_BASE = 'dietAssistantApiBase';
  const STORAGE_LANGUAGE = 'dietAssistantLanguage';
  const SESSION_PASSCODE = 'dietFamilyPasscode';
  const CHAT_INACTIVITY_MS = 10 * 60 * 1000;
  const MAX_CHAT_TURNS = 8;
  const DEFAULT_ENDPOINTS = {
    ask: '/api/ask',
    transcribe: '/api/transcribe',
    health: '/api/health',
    unlock: '/api/health-profile/unlock',
    profile: '/api/health-profile',
    preview: '/api/plan-preview',
    apply: '/api/plan-preview/apply'
  };

  const HEALTH_MEMBERS = [
    {
      id: 'suresh',
      name: 'Suresh',
      role: 'Nannagaru',
      fields: [
        { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', type: 'number', step: '1' },
        { key: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', type: 'number', step: '1' },
        { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', step: '0.1' },
        { key: 'kneePain', label: 'Knee pain', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'sciaticaPain', label: 'Sciatica pain', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'activity', label: 'Activity today', type: 'text', wide: true, placeholder: 'Walked 15 min, physio done, etc.' },
        { key: 'doctorWarnings', label: 'Doctor warnings / red flags', type: 'text', wide: true, placeholder: 'Chest tightness, dizziness, anything the doctor flagged' }
      ]
    },
    {
      id: 'veni',
      name: 'Veni',
      role: 'Ammagaru',
      fields: [
        { key: 'fastingGlucose', label: 'Fasting glucose', unit: 'mg/dL', type: 'number', step: '1' },
        { key: 'postMealGlucose', label: 'Post-meal glucose', unit: 'mg/dL', type: 'number', step: '1' },
        { key: 'hba1c', label: 'HbA1c', unit: '%', type: 'number', step: '0.1' },
        { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', step: '0.1' },
        { key: 'spondylitisPain', label: 'Spondylitis pain', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'glaucomaWarnings', label: 'Eye / glaucoma notes', type: 'text', wide: true, placeholder: 'Vision blur, eye pressure, last check-up' },
        { key: 'doctorWarnings', label: 'Doctor warnings / red flags', type: 'text', wide: true, placeholder: 'Anything the doctor flagged' }
      ]
    },
    {
      id: 'susheel',
      name: 'Susheel',
      role: 'Younger son',
      fields: [
        { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', step: '0.1' },
        { key: 'alt', label: 'ALT (SGPT)', unit: 'U/L', type: 'number', step: '1' },
        { key: 'ast', label: 'AST (SGOT)', unit: 'U/L', type: 'number', step: '1' },
        { key: 'energyLevel', label: 'Energy level', unit: '1–10', type: 'number', step: '1', min: 1, max: 10 },
        { key: 'snackCravings', label: 'Snack cravings', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'fattyLiverGrade', label: 'Fatty liver grade', type: 'text', wide: true, placeholder: 'e.g. grade 2 on last scan' },
        { key: 'doctorWarnings', label: 'Doctor warnings / red flags', type: 'text', wide: true, placeholder: 'Anything the doctor flagged' }
      ]
    },
    {
      id: 'karthik',
      name: 'Karthikeya',
      role: 'Elder son',
      fields: [
        { key: 'weightKg', label: 'Weight', unit: 'kg', type: 'number', step: '0.1' },
        { key: 'painLevel', label: 'Pain level', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'swellingLevel', label: 'Swelling level', unit: '0–10', type: 'number', step: '1', min: 0, max: 10 },
        { key: 'recoveryStage', label: 'Recovery stage', type: 'text', wide: true, placeholder: 'Weeks post-op, weight-bearing status' },
        { key: 'physioStatus', label: 'Physio status', type: 'text', wide: true, placeholder: 'Sessions this week, exercises done or missed' },
        { key: 'doctorWarnings', label: 'Doctor warnings / red flags', type: 'text', wide: true, placeholder: 'Anything the doctor flagged' }
      ]
    }
  ];

  const state = {
    mediaRecorder: null,
    audioChunks: [],
    audioStream: null,
    activeRequest: null,
    chatMessages: [],
    lastActivityAt: 0,
    inactivityTimer: null,
    healthProfile: null,
    healthPreview: null,
    activeMemberId: 'suresh'
  };

  const DAILY_EXAMPLES = [
    {
      label: 'Sunday festival suggestions',
      questions: [
        'How much ven pongal is safe today for Amma and Nannagaru?',
        'If we make festival sweet today, when should everyone eat it?',
        'What can I cook if we do not have foxtail millet for Sunday pongal?',
        'How do I keep Sunday dinner light after a heavy lunch?',
        'What should Susheel and Karthik adjust if they ate extra sweet today?'
      ]
    },
    {
      label: 'Monday suggestions',
      questions: [
        'How do I make Monday idli and sambar breakfast quickly?',
        'I do not have bottle gourd for tonight. What can I cook instead?',
        'How do I make Monday bitter gourd tasty without deep frying?',
        'If we skipped sundal snack today, what is a safe replacement?',
        'Can Amma eat curd with Monday lunch if sugar is high?'
      ]
    },
    {
      label: 'Tuesday suggestions',
      questions: [
        'What is the fastest way to make Tuesday pesarattu breakfast?',
        'If I ate dosa instead of pesarattu today, what should I adjust now?',
        'I do not have ridge gourd for lunch. What can I use instead?',
        'Can Amma eat jonna roti and ash gourd pulusu tonight?',
        'What Tuesday snack is safe for Nannagaru if he is hungry?'
      ]
    },
    {
      label: 'Wednesday suggestions',
      questions: [
        'How do I make Wednesday ragi dosa quickly and tasty?',
        'If ragi dosa batter is not ready, what breakfast can I make today?',
        'Can Amma have coconut chutney with ragi dosa today?',
        'What should we do if lunch gets delayed on Wednesday?',
        'How much ragi is okay for Nannagaru at dinner?'
      ]
    },
    {
      label: 'Thursday suggestions',
      questions: [
        'What can I cook today if millet is not available?',
        'How do I make Thursday lunch filling without too much rice?',
        'If someone ate extra rice today, how should dinner change?',
        'Can Amma eat attu with allam chutney tonight?',
        'What is a safe Thursday evening snack for everyone?'
      ]
    },
    {
      label: 'Friday suggestions',
      questions: [
        'How do I make Friday ponganalu taste good with less oil?',
        'What should Suresh and Amma eat instead of brinjal today?',
        'If we only have regular vada, how do we make it safer?',
        'Can Amma eat Friday night idli with curd?',
        'What should the boys adjust if they ate extra chutney today?'
      ]
    },
    {
      label: 'Saturday suggestions',
      questions: [
        'How do I make Saturday uggani more protein-rich?',
        'I do not have dosakaya for lunch. What can I use instead?',
        'Can Amma eat methi pappu and rice today if sugar is high?',
        'What should we batch-prep today for next week?',
        'How do I keep Saturday dinner light but filling?'
      ]
    }
  ];

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function isAdminMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('admin') === '1';
    } catch (e) {
      return false;
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
      DEFAULT_API_BASE
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

  function getTodayExamples(now) {
    const dayIndex = (now || new Date()).getDay();
    return DAILY_EXAMPLES[dayIndex] || DAILY_EXAMPLES[1];
  }

  function createWidget() {
    if (document.getElementById('diet-assistant-root')) return;

    const adminMode = isAdminMode();
    const todayExamples = getTodayExamples();
    const root = document.createElement('div');
    root.id = 'diet-assistant-root';
    root.className = 'diet-assistant no-print' + (adminMode ? ' admin-mode' : '');
    root.innerHTML = `
      <button class="da-launcher" id="da-launcher" type="button" aria-controls="da-panel" aria-expanded="false">
        <span class="da-launcher-main">${adminMode ? 'Admin · Ask' : 'Ask Diet Doubts'}</span>
        <span class="da-launcher-sub">${adminMode ? 'Update readings or ask questions' : 'Text or voice question'}</span>
      </button>

      <section class="da-panel" id="da-panel" role="dialog" aria-label="Diet plan assistant" hidden>
        <div class="da-head">
          <div>
            <h2>${adminMode ? 'Diet Plan Admin' : 'Ask the Diet Plan'}</h2>
            <p>${adminMode ? 'Update health readings, build previews, or ask a question.' : 'Ask substitutions, taste fixes, meal swaps, and family doubts in text or voice.'}</p>
          </div>
          <button class="da-close" id="da-close" type="button" aria-label="Close assistant">×</button>
        </div>

        ${adminMode ? `<div class="da-tabs" role="tablist">
          <button class="da-tab active" id="da-tab-ask" type="button" role="tab" aria-selected="true" data-tab="ask">Ask</button>
          <button class="da-tab" id="da-tab-health" type="button" role="tab" aria-selected="false" data-tab="health">Update readings</button>
        </div>` : ''}

        <div class="da-body">
          <div class="da-tabpanel" id="da-panel-ask" role="tabpanel">
            <div class="da-setup" id="da-setup" hidden>
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
                <div class="da-backend-line" id="da-backend-line">Backend connected</div>
                <label class="da-field" for="da-language">
                  Voice and answer language
                  <select id="da-language">
                    <option value="telugu">Telugu (best for voice)</option>
                    <option value="english">English</option>
                    <option value="hinglish">Simple Hindi + English</option>
                    <option value="auto">Auto-detect typed question</option>
                  </select>
                </label>
                <label class="da-check">
                  <input id="da-auto-ask" type="checkbox" checked>
                  Ask automatically after voice transcription
                </label>
              </div>
            </details>

            <div class="da-examples-wrap">
              <div class="da-examples-title">${escapeHtml(todayExamples.label)}</div>
              <div class="da-examples" aria-label="Suggested questions for ${escapeAttribute(todayExamples.label)}">
                ${todayExamples.questions.map(example => `<button class="da-chip" type="button" data-question="${escapeAttribute(example)}">${escapeHtml(example)}</button>`).join('')}
              </div>
            </div>

            <div class="da-chat" id="da-chat" aria-live="polite" aria-label="Diet assistant chat">
              <div class="da-chat-empty">Ask a question to start a chat. Follow-up questions will remember the recent conversation.</div>
            </div>

            <div class="da-composer-block">
              <label class="da-question-label" for="da-question">Your question</label>
              <div class="da-composer">
                <textarea id="da-question" rows="3" placeholder="Ask a doubt about today&apos;s meal, ingredients, or substitutions..."></textarea>
                <div class="da-composer-actions">
                  <div class="da-composer-left">
                    <button class="da-icon-btn mic" id="da-mic" type="button" title="Start voice question" aria-label="Start voice question">Voice</button>
                    <button class="da-icon-btn" id="da-clear" type="button" title="Start a fresh chat" aria-label="Start a fresh chat">New chat</button>
                  </div>
                  <button class="da-send-btn" id="da-ask" type="button" aria-label="Ask the diet assistant">Ask</button>
                </div>
              </div>
            </div>

            <div class="da-status" id="da-status" role="status" hidden></div>

            <div class="da-followups" id="da-followups" hidden>
              <p>Try asking next</p>
              <div class="da-row tight" id="da-followup-list"></div>
            </div>
          </div>

          ${adminMode ? `<div class="da-tabpanel" id="da-panel-health" role="tabpanel" hidden>
            <div class="da-hc" id="da-hc">
              <div class="da-hc-lock" id="da-hc-lock">
                <div class="da-hc-lock-title">Health Center is private</div>
                <p class="da-hc-lock-text">Enter the family passcode to open the shared health readings. It stays only in this browser tab.</p>
                <label class="da-field" for="da-hc-passcode">
                  Family passcode
                  <input id="da-hc-passcode" type="password" autocomplete="off" inputmode="numeric" placeholder="••••">
                </label>
                <div class="da-row tight">
                  <button class="da-btn primary" id="da-hc-unlock" type="button">Unlock</button>
                </div>
                <div class="da-status" id="da-hc-lock-status" role="status" hidden></div>
              </div>

              <div class="da-hc-workspace" id="da-hc-workspace" hidden>
                <div class="da-hc-toolbar">
                  <div class="da-hc-toolbar-title">Health Center</div>
                  <button class="da-icon-btn" id="da-hc-lock-btn" type="button" title="Lock Health Center" aria-label="Lock Health Center">Lock</button>
                </div>

                <div class="da-hc-members" role="tablist" id="da-hc-members"></div>
                <form class="da-hc-form" id="da-hc-form" novalidate>
                  <div class="da-hc-fields" id="da-hc-fields"></div>
                  <label class="da-field" for="da-hc-notes">
                    Notes for the doctor or family
                    <textarea id="da-hc-notes" rows="2" placeholder="Anything unusual today?"></textarea>
                  </label>
                  <div class="da-row tight">
                    <button class="da-btn primary" id="da-hc-save" type="submit">Save entry</button>
                    <button class="da-btn" id="da-hc-preview" type="button">Build preview</button>
                  </div>
                  <div class="da-status" id="da-hc-status" role="status" hidden></div>
                </form>

                <div class="da-hc-latest" id="da-hc-latest"></div>

                <div class="da-hc-preview" id="da-hc-preview" hidden>
                  <div class="da-hc-preview-head">
                    <h3>Suggested changes</h3>
                    <button class="da-btn primary" id="da-hc-apply" type="button">Apply to plan</button>
                  </div>
                  <div class="da-hc-doctor-banner" id="da-hc-doctor-banner" hidden>
                    One or more readings need doctor review. Diet suggestions are supportive only.
                  </div>
                  <div class="da-hc-reclist" id="da-hc-reclist"></div>
                </div>
              </div>
            </div>
          </div>` : ''}
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

    root.querySelectorAll('.da-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(root, tab.dataset.tab));
    });

    root.querySelectorAll('#da-panel-ask .da-chip').forEach(chip => {
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

    if (isAdminMode()) bindHealthCenter(root);
  }

  function switchTab(root, tabName) {
    const tabs = root.querySelectorAll('.da-tab');
    tabs.forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const askPanel = root.querySelector('#da-panel-ask');
    const healthPanel = root.querySelector('#da-panel-health');
    if (askPanel) askPanel.hidden = tabName !== 'ask';
    if (healthPanel) healthPanel.hidden = tabName !== 'health';
    if (tabName === 'health' && healthPanel) openHealthCenter(root);
  }

  function bindHealthCenter(root) {
    const unlockBtn = root.querySelector('#da-hc-unlock');
    const passcodeInput = root.querySelector('#da-hc-passcode');
    const lockBtn = root.querySelector('#da-hc-lock-btn');
    const form = root.querySelector('#da-hc-form');
    const previewBtn = root.querySelector('#da-hc-preview');
    const applyBtn = root.querySelector('#da-hc-apply');

    unlockBtn.addEventListener('click', () => unlockHealthCenter(root));
    passcodeInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        unlockHealthCenter(root);
      }
    });
    lockBtn.addEventListener('click', () => lockHealthCenter(root));
    form.addEventListener('submit', event => {
      event.preventDefault();
      saveHealthEntry(root);
    });
    previewBtn.addEventListener('click', () => buildHealthPreview(root));
    applyBtn.addEventListener('click', () => applyHealthPreview(root));

    renderMemberTabs(root);
    renderMemberFields(root);
  }

  function renderMemberTabs(root) {
    const list = root.querySelector('#da-hc-members');
    list.innerHTML = HEALTH_MEMBERS.map(member => `
      <button class="da-hc-member" type="button" role="tab" data-member="${escapeAttribute(member.id)}" aria-selected="${member.id === state.activeMemberId ? 'true' : 'false'}">
        <span class="da-hc-member-name">${escapeHtml(member.name)}</span>
        <span class="da-hc-member-role">${escapeHtml(member.role)}</span>
      </button>
    `).join('');
    list.querySelectorAll('.da-hc-member').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeMemberId = btn.dataset.member;
        list.querySelectorAll('.da-hc-member').forEach(other => {
          other.setAttribute('aria-selected', other === btn ? 'true' : 'false');
        });
        renderMemberFields(root);
        renderLatestEntry(root);
      });
    });
  }

  function activeMember() {
    return HEALTH_MEMBERS.find(m => m.id === state.activeMemberId) || HEALTH_MEMBERS[0];
  }

  function renderMemberFields(root) {
    const wrap = root.querySelector('#da-hc-fields');
    const member = activeMember();
    wrap.innerHTML = member.fields.map(field => {
      const isText = field.type === 'text';
      const inputType = isText ? 'text' : 'number';
      const stepAttr = isText ? '' : ` step="${escapeAttribute(field.step || '1')}"`;
      const minAttr = field.min != null ? ` min="${field.min}"` : '';
      const maxAttr = field.max != null ? ` max="${field.max}"` : '';
      const wideClass = field.wide ? ' da-hc-field-wide' : '';
      const placeholder = field.placeholder ? ` placeholder="${escapeAttribute(field.placeholder)}"` : '';
      const unitLabel = field.unit ? ` <span class="da-hc-unit">(${escapeHtml(field.unit)})</span>` : '';
      return `
        <label class="da-field${wideClass}" for="da-hc-field-${escapeAttribute(field.key)}">
          ${escapeHtml(field.label)}${unitLabel}
          <input id="da-hc-field-${escapeAttribute(field.key)}" name="${escapeAttribute(field.key)}" type="${inputType}"${stepAttr}${minAttr}${maxAttr}${placeholder} autocomplete="off">
        </label>
      `;
    }).join('');
    root.querySelector('#da-hc-notes').value = '';
    root.querySelector('#da-hc-doctor-banner').hidden = true;
    renderLatestEntry(root);
  }

  function renderLatestEntry(root) {
    const wrap = root.querySelector('#da-hc-latest');
    const profile = state.healthProfile;
    if (!profile) { wrap.innerHTML = ''; return; }
    const member = (profile.members || []).find(m => m.memberId === state.activeMemberId);
    if (!member || !member.latest) {
      wrap.innerHTML = '<div class="da-hc-latest-empty">No entries saved for this person yet.</div>';
      return;
    }
    const latest = member.latest;
    const when = latest.measuredAt ? new Date(latest.measuredAt).toLocaleString() : '';
    const values = Object.entries(latest.values || {})
      .map(([k, v]) => `<span class="da-hc-chip"><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</span>`)
      .join('');
    wrap.innerHTML = `
      <div class="da-hc-latest-head">Last update ${escapeHtml(when)}</div>
      <div class="da-hc-latest-values">${values || '<span class="da-hc-latest-empty">No values saved yet.</span>'}</div>
      ${latest.notes ? `<div class="da-hc-latest-notes">${escapeHtml(latest.notes)}</div>` : ''}
    `;
  }

  function openHealthCenter(root) {
    if (!getApiBase()) {
      setHealthLockStatus(root, 'Backend is not connected. Connect it in the Ask tab first.', 'error');
      return;
    }
    if (getPasscode()) {
      showHealthWorkspace(root, true);
      loadHealthProfile(root).catch(() => {});
    } else {
      showHealthWorkspace(root, false);
      setTimeout(() => root.querySelector('#da-hc-passcode').focus(), 40);
    }
  }

  function getPasscode() {
    try { return sessionStorage.getItem(SESSION_PASSCODE) || ''; } catch (e) { return ''; }
  }

  function setPasscode(value) {
    try {
      if (value) sessionStorage.setItem(SESSION_PASSCODE, value);
      else sessionStorage.removeItem(SESSION_PASSCODE);
    } catch (e) { /* ignore */ }
  }

  function showHealthWorkspace(root, unlocked) {
    root.querySelector('#da-hc-lock').hidden = unlocked;
    root.querySelector('#da-hc-workspace').hidden = !unlocked;
  }

  async function unlockHealthCenter(root) {
    const value = String(root.querySelector('#da-hc-passcode').value || '').trim();
    if (!value) {
      setHealthLockStatus(root, 'Enter the family passcode to continue.', 'error');
      return;
    }
    setHealthLockStatus(root, 'Checking passcode...');
    try {
      await postJson(buildUrl(endpointConfig().unlock), {}, { 'X-Family-Passcode': value });
      setPasscode(value);
      setHealthLockStatus(root, '');
      showHealthWorkspace(root, true);
      await loadHealthProfile(root);
    } catch (error) {
      setPasscode('');
      setHealthLockStatus(root, error.message || 'Could not unlock.', 'error');
    }
  }

  function lockHealthCenter(root) {
    setPasscode('');
    state.healthProfile = null;
    state.healthPreview = null;
    root.querySelector('#da-hc-passcode').value = '';
    root.querySelector('#da-hc-preview').hidden = true;
    showHealthWorkspace(root, false);
    setHealthLockStatus(root, 'Locked. Enter the passcode again to reopen.', 'success');
  }

  async function loadHealthProfile(root) {
    setHealthStatus(root, 'Loading profile...');
    try {
      const data = await getJson(buildUrl(endpointConfig().profile), { 'X-Family-Passcode': getPasscode() });
      state.healthProfile = data.profile || null;
      setHealthStatus(root, '');
      renderLatestEntry(root);
    } catch (error) {
      setHealthStatus(root, error.message || 'Could not load profile.', 'error');
    }
  }

  async function saveHealthEntry(root) {
    const member = activeMember();
    const values = collectMemberValues(root, member);
    const notes = String(root.querySelector('#da-hc-notes').value || '').trim();
    if (Object.keys(values).length === 0 && !notes) {
      setHealthStatus(root, 'Enter at least one value before saving.', 'error');
      return;
    }
    setHealthStatus(root, 'Saving entry...');
    try {
      const data = await postJson(buildUrl(endpointConfig().profile), {
        memberId: member.id,
        entry: { values, notes, measuredAt: new Date().toISOString() }
      }, { 'X-Family-Passcode': getPasscode() });
      state.healthProfile = data.profile || state.healthProfile;
      setHealthStatus(root, 'Entry saved for ' + member.name + '.', 'success');
      renderLatestEntry(root);
    } catch (error) {
      setHealthStatus(root, error.message || 'Could not save.', 'error');
    }
  }

  function collectMemberValues(root, member) {
    const values = {};
    member.fields.forEach(field => {
      const input = root.querySelector('#da-hc-field-' + cssEscape(field.key));
      if (!input) return;
      const raw = String(input.value || '').trim();
      if (raw === '') return;
      if (field.type === 'text') {
        values[field.key] = raw;
        return;
      }
      const number = Number(raw);
      if (!Number.isFinite(number)) return;
      values[field.key] = number;
    });
    return values;
  }

  async function buildHealthPreview(root) {
    setHealthStatus(root, 'Building suggestions...');
    try {
      const data = await postJson(buildUrl(endpointConfig().preview), {}, { 'X-Family-Passcode': getPasscode() });
      state.healthPreview = data;
      renderPreview(root, data.recommendations || []);
      setHealthStatus(root, '');
    } catch (error) {
      setHealthStatus(root, error.message || 'Could not build preview.', 'error');
    }
  }

  async function applyHealthPreview(root) {
    setHealthStatus(root, 'Sending to assistant...');
    try {
      const data = await postJson(buildUrl(endpointConfig().apply), {}, { 'X-Family-Passcode': getPasscode() });
      state.healthPreview = data;
      renderPreview(root, data.recommendations || []);
      setHealthStatus(root, data.applied ? 'Assistant will use the latest health context.' : 'No active recommendations. Assistant will use the standard plan.', 'success');
    } catch (error) {
      setHealthStatus(root, error.message || 'Could not apply preview.', 'error');
    }
  }

  function renderPreview(root, recommendations) {
    const wrap = root.querySelector('#da-hc-preview');
    const list = root.querySelector('#da-hc-reclist');
    const banner = root.querySelector('#da-hc-doctor-banner');
    if (!recommendations.length) {
      wrap.hidden = false;
      banner.hidden = true;
      list.innerHTML = '<div class="da-hc-latest-empty">No adjustments needed for the latest readings.</div>';
      return;
    }
    banner.hidden = !recommendations.some(rec => rec.doctorReviewRequired);
    list.innerHTML = recommendations.map(rec => `
      <div class="da-hc-rec priority-${escapeAttribute(rec.priority || 'medium')}">
        <div class="da-hc-rec-head">
          <span class="da-hc-rec-person">${escapeHtml(personLabel(rec.personId))}</span>
          <span class="da-hc-rec-priority">${escapeHtml(rec.priority || 'medium')}</span>
          ${rec.doctorReviewRequired ? '<span class="da-hc-rec-doctor">Doctor review</span>' : ''}
        </div>
        <div class="da-hc-rec-body">
          <p class="da-hc-rec-suggested"><b>Try:</b> ${escapeHtml(rec.suggestedText || '')}</p>
          <p class="da-hc-rec-reason"><b>Why:</b> ${escapeHtml(rec.reason || '')}</p>
          <a class="da-hc-rec-jump" href="#${escapeAttribute(rec.targetSectionId || '')}">Jump to plan section</a>
        </div>
      </div>
    `).join('');
    wrap.hidden = false;
  }

  function personLabel(id) {
    const member = HEALTH_MEMBERS.find(m => m.id === id);
    return member ? (member.name + ' · ' + member.role) : (id || 'Family');
  }

  function setHealthStatus(root, message, type) {
    const status = root.querySelector('#da-hc-status');
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function setHealthLockStatus(root, message, type) {
    const status = root.querySelector('#da-hc-lock-status');
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function cssEscape(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function loadSettings(root) {
    root.querySelector('#da-api-base').value = getApiBase();
    root.querySelector('#da-language').value = localStorage.getItem(STORAGE_LANGUAGE) || 'telugu';
  }

  function setPanelOpen(root, open) {
    const panel = root.querySelector('#da-panel');
    const launcher = root.querySelector('#da-launcher');
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      if (getApiBase()) clearStatus(root);
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
    const backendLine = root.querySelector('#da-backend-line');
    const base = getApiBase();
    setup.classList.toggle('connected', Boolean(base));
    if (base) {
      setup.hidden = true;
      title.textContent = 'Backend connected';
      text.textContent = base + ' will receive questions and voice audio. The Groq key must remain only in that backend.';
      if (backendLine) backendLine.textContent = 'Backend connected: ' + base.replace(/^https?:\/\//, '');
      clearStatus(root);
    } else {
      setup.hidden = false;
      title.textContent = 'Backend not connected yet';
      text.textContent = 'After Claude deploys the backend, paste its URL here. Example: https://your-project.vercel.app';
      if (backendLine) backendLine.textContent = 'Backend not connected';
      setStatus(root, 'Paste and save the backend URL before asking.', 'error');
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
      setStatus(root, 'Backend is not connected. Open Assistant settings and check the backend URL.', 'error');
      root.querySelector('#da-api-base').focus();
      return;
    }

    resetChatIfInactive(root);
    const conversation = recentConversation();
    appendChatMessage(root, 'user', question);
    questionEl.value = '';
    setBusy(root, true, state.chatMessages.length > 1 ? 'Continuing chat...' : 'Starting chat...');
    hideFollowups(root);
    try {
      const payload = buildAskPayload(root, question, conversation);
      const data = await postJson(buildUrl(endpointConfig().ask), payload);
      const answer = data.answer || data.message || data.text || '';
      if (!answer.trim()) {
        throw new Error('The backend replied, but no answer field was found.');
      }
      appendChatMessage(root, 'assistant', answer.trim());
      renderFollowups(root, data.followUps || data.followups || data.suggestedQuestions || []);
      clearStatus(root);
    } catch (error) {
      removeLastUserMessage(root, question);
      setStatus(root, error.message, 'error');
    } finally {
      setBusy(root, false);
    }
  }

  function buildAskPayload(root, question, conversation) {
    const activeSection = getActiveSection();
    return {
      documentId: DOCUMENT_ID,
      question,
      language: root.querySelector('#da-language').value,
      sourceUrl: location.href,
      pageTitle: document.title,
      selectedText: getSelectedText(),
      currentSection: activeSection,
      conversation: conversation || [],
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
      setStatus(root, 'Backend is not connected. Open Assistant settings and check the backend URL.', 'error');
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
      root.querySelector('#da-mic').textContent = 'Stop';
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
      root.querySelector('#da-question').value = transcript;
      if (data.languageHint === 'te' && root.querySelector('#da-language').value === 'auto') {
        root.querySelector('#da-language').value = 'telugu';
      }
      clearStatus(root);
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
    mic.textContent = 'Voice';
    mic.classList.remove('recording');
  }

  async function postJson(url, payload, extraHeaders) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {})
    });
    return parseResponse(response);
  }

  async function getJson(url, extraHeaders) {
    const response = await fetch(url, {
      method: 'GET',
      headers: Object.assign({}, extraHeaders || {})
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
    appendChatMessage(root, 'assistant', answer.trim());
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

  function clearAssistant(root) {
    resetChat(root, 'New chat started. Ask a question or use voice.');
    root.querySelector('#da-question').value = '';
    hideFollowups(root);
    if (getApiBase()) {
      clearStatus(root);
    } else {
      setStatus(root, 'Ready when the backend URL is connected.');
    }
  }

  function appendChatMessage(root, role, text) {
    state.chatMessages.push({ role, content: String(text || '').trim(), ts: Date.now() });
    if (state.chatMessages.length > MAX_CHAT_TURNS * 2) {
      state.chatMessages = state.chatMessages.slice(-MAX_CHAT_TURNS * 2);
    }
    renderChat(root);
    touchChat(root);
  }

  function removeLastUserMessage(root, question) {
    const idx = state.chatMessages.map(m => m.role + ':' + m.content).lastIndexOf('user:' + question);
    if (idx >= 0) state.chatMessages.splice(idx, 1);
    renderChat(root);
  }

  function renderChat(root) {
    const chat = root.querySelector('#da-chat');
    if (!chat) return;
    if (state.chatMessages.length === 0) {
      chat.innerHTML = '<div class="da-chat-empty">Ask a question to start a chat. Follow-up questions will remember the recent conversation.</div>';
      return;
    }
    chat.innerHTML = state.chatMessages.map(message => `
      <div class="da-msg ${message.role === 'user' ? 'user' : 'assistant'}">
        <div class="da-msg-role">${message.role === 'user' ? 'You' : 'Diet assistant'}</div>
        <div class="da-msg-text">${escapeHtml(message.content)}</div>
      </div>
    `).join('');
    chat.scrollTop = chat.scrollHeight;
  }

  function recentConversation() {
    return state.chatMessages
      .slice(-MAX_CHAT_TURNS)
      .map(message => ({ role: message.role, content: message.content }));
  }

  function touchChat(root) {
    state.lastActivityAt = Date.now();
    if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
    state.inactivityTimer = setTimeout(() => {
      resetChat(root, 'Chat reset after inactivity. Ask a new question when ready.');
      clearStatus(root);
    }, CHAT_INACTIVITY_MS);
  }

  function resetChatIfInactive(root) {
    if (state.lastActivityAt && Date.now() - state.lastActivityAt > CHAT_INACTIVITY_MS) {
      resetChat(root, 'Chat reset after inactivity. Ask a new question when ready.');
    }
  }

  function resetChat(root) {
    state.chatMessages = [];
    state.lastActivityAt = 0;
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }
    renderChat(root);
  }

  function setStatus(root, message, type) {
    const status = root.querySelector('#da-status');
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('error', type === 'error');
    status.classList.toggle('success', type === 'success');
  }

  function clearStatus(root) {
    setStatus(root, '');
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

  const PERSON_SELECTORS = {
    suresh: '.pp:not(.v):not(.su):not(.k)',
    veni: '.pp.v',
    susheel: '.pp.su',
    karthik: '.pp.k'
  };

  const PERSON_LABELS = {
    suresh: 'Suresh',
    veni: 'Veni',
    susheel: 'Susheel',
    karthik: 'Karthikeya'
  };

  async function applyMealPlanAdjustments() {
    const base = getApiBase();
    if (!base) return;
    let data;
    try {
      const response = await fetch(base + '/api/plan-adjustments', { method: 'GET', cache: 'no-store' });
      if (!response.ok) return;
      data = await response.json();
    } catch (error) {
      return;
    }
    const recommendations = Array.isArray(data && data.recommendations) ? data.recommendations : [];
    if (!recommendations.length) return;
    injectDoctorReviewBanner(recommendations);
    injectSectionSummary(recommendations);
    applyPerCardAdjustments(recommendations);
  }

  function applyPerCardAdjustments(recommendations) {
    const s3 = document.getElementById('s3');
    if (!s3) return;
    const byPerson = new Map();
    recommendations
      .filter(rec => (rec.targetSectionId || '').toLowerCase() === 's3')
      .forEach(rec => {
        const existing = byPerson.get(rec.personId);
        if (!existing || priorityRank(rec.priority) > priorityRank(existing.priority)) {
          byPerson.set(rec.personId, rec);
        }
      });
    byPerson.forEach((rec, personId) => {
      const selector = PERSON_SELECTORS[personId];
      if (!selector) return;
      s3.querySelectorAll(selector).forEach(card => rewriteCard(card, rec));
    });
  }

  function priorityRank(priority) {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    if (priority === 'low') return 1;
    return 0;
  }

  function rewriteCard(card, rec) {
    if (!card || card.classList.contains('pp-adjusted')) return;
    const label = card.querySelector('b');
    const teNodes = Array.from(card.querySelectorAll('.te'));
    const labelHtml = label ? label.outerHTML : '';
    const teHtml = teNodes.map(node => node.outerHTML).join('');
    const originalBody = extractOriginalBody(card);
    card.classList.add('pp-adjusted', 'pp-priority-' + (rec.priority || 'medium'));
    card.innerHTML = `
      <div class="pp-badge">${escapeHtml(deriveBadgeText(rec))}</div>
      ${labelHtml}
      <div class="pp-original">${escapeHtml(originalBody)}</div>
      <div class="pp-add"><b>Today:</b> ${escapeHtml(rec.suggestedText || '')}</div>
      ${rec.reason ? `<div class="pp-why"><i>Why:</i> ${escapeHtml(rec.reason)}</div>` : ''}
      ${teHtml}
    `;
  }

  function extractOriginalBody(card) {
    const clone = card.cloneNode(true);
    clone.querySelectorAll('b').forEach(node => node.remove());
    clone.querySelectorAll('.te').forEach(node => node.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function deriveBadgeText(rec) {
    const person = PERSON_LABELS[rec.personId] || 'Family';
    if (rec.doctorReviewRequired) return 'Doctor review — ' + person;
    if (rec.priority === 'high') return 'Important today — ' + person;
    if (rec.priority === 'low') return 'Small tip — ' + person;
    return 'Adjusted today — ' + person;
  }

  function injectDoctorReviewBanner(recommendations) {
    const doctorRecs = recommendations.filter(rec => rec.doctorReviewRequired);
    if (!doctorRecs.length) return;
    if (document.getElementById('adaptive-doctor-banner')) return;
    const affected = Array.from(new Set(doctorRecs.map(rec => PERSON_LABELS[rec.personId] || 'family')));
    const banner = document.createElement('div');
    banner.id = 'adaptive-doctor-banner';
    banner.className = 'adaptive-doctor-banner no-print';
    banner.innerHTML = `
      <div class="adaptive-doctor-banner-inner">
        <div class="adaptive-doctor-banner-title">Please review with the doctor today</div>
        <div class="adaptive-doctor-banner-body">
          Recent readings for <b>${escapeHtml(affected.join(', '))}</b> need medical review. The meal adjustments below are supportive only — do not stop or change medication.
        </div>
      </div>
    `;
    const hero = document.querySelector('header.hero');
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(banner, hero.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  function injectSectionSummary(recommendations) {
    const s3Recs = recommendations.filter(rec => (rec.targetSectionId || '').toLowerCase() === 's3');
    if (!s3Recs.length) return;
    const s3 = document.getElementById('s3');
    if (!s3) return;
    if (s3.querySelector('.adaptive-summary')) return;
    const body = s3.querySelector('.section-body');
    if (!body) return;
    const byPerson = new Map();
    s3Recs.forEach(rec => {
      if (!byPerson.has(rec.personId)) byPerson.set(rec.personId, rec);
      else if (priorityRank(rec.priority) > priorityRank(byPerson.get(rec.personId).priority)) {
        byPerson.set(rec.personId, rec);
      }
    });
    const items = Array.from(byPerson.entries()).map(([personId, rec]) => {
      const person = PERSON_LABELS[personId] || personId;
      return `<li><b>${escapeHtml(person)}:</b> ${escapeHtml(rec.suggestedText || '')}</li>`;
    }).join('');
    const summary = document.createElement('div');
    summary.className = 'adaptive-summary no-print';
    summary.innerHTML = `
      <div class="adaptive-summary-title">Today's plan is adjusted for the latest readings</div>
      <ul>${items}</ul>
      <div class="adaptive-summary-note">Original plan text is preserved below each card.</div>
    `;
    body.insertBefore(summary, body.firstChild);
  }

  ready(() => {
    createWidget();
    applyMealPlanAdjustments().catch(() => {});
  });
})();
