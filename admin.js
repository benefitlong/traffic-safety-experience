(() => {
  'use strict';

  const SETTINGS_KEY = 'stoppingDistanceSettings';
  const SESSIONS_KEY = 'stoppingDistanceSessions';
  const INITIAL_ADMIN_PASSWORD = '1234';
  const SPEEDS = [30, 40, 50, 60, 70, 80, 90, 100];
  const SURVEY_ANSWER_VERSION = 2;
  const LEGACY_CORRECT_CODES = { q1: 3, q2: 3, q3: 3 };
  const CORRECT_CODES = { q1: 3, q2: 2, q3: 3 };
  const DEFAULT_SETTINGS = {
    surveyEnabled: true,
    availableSpeeds: [...SPEEDS],
    defaultSpeed: 50,
    soundEnabled: true,
    autoReturn: true,
    autoReturnSeconds: 25
  };

  let settings = loadSettings();
  let sessions = loadSessions();
  let activeSession = null;
  let showScreen = null;

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* 저장 불가 환경에서는 현재 탭에서만 유지 */ }
  }

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }

  function loadSettings() {
    const saved = safeParse(readStorage(SETTINGS_KEY), {});
    const available = Array.isArray(saved.availableSpeeds)
      ? saved.availableSpeeds.filter((speed) => SPEEDS.includes(Number(speed))).map(Number)
      : [...SPEEDS];
    if (!available.includes(50)) available.push(50);
    return { ...DEFAULT_SETTINGS, ...saved, availableSpeeds: available, defaultSpeed: 50 };
  }

  function loadSessions() {
    const saved = safeParse(readStorage(SESSIONS_KEY), []);
    return Array.isArray(saved) ? saved : [];
  }

  function saveSettings() {
    writeStorage(SETTINGS_KEY, JSON.stringify(settings));
    window.SurveyModule.setEnabled(settings.surveyEnabled);
  }

  function saveSessions() {
    writeStorage(SESSIONS_KEY, JSON.stringify(sessions));
  }

  function nextSessionId() {
    const highest = sessions.reduce((max, session) => {
      const number = Number(String(session.sessionId || '').replace('SESSION-', '')) || 0;
      return Math.max(max, number);
    }, 0);
    return `SESSION-${String(highest + 1).padStart(6, '0')}`;
  }

  function beginSession() {
    activeSession = { sessionId: nextSessionId(), datetime: new Date().toISOString() };
  }

  function completeSession(data) {
    if (!activeSession) beginSession();
    const record = {
      sessionId: activeSession.sessionId,
      datetime: activeSession.datetime,
      surveyAnswerVersion: SURVEY_ANSWER_VERSION,
      pre: { ...(data.survey.pre || {}) },
      post: { ...(data.survey.post || {}) },
      experiencedSpeeds: data.experiences.map((item) => item.speed),
      experienceCount: data.experiences.length,
      experiences: data.experiences.map((item) => ({ ...item }))
    };
    sessions.push(record);
    saveSessions();
    activeSession = null;
    return record;
  }

  function percent(value, total) {
    return total ? Math.round(value / total * 100) : 0;
  }

  function completedSurveySessions() {
    return sessions.filter((session) => [1, 2, 3].every((q) =>
      Number.isInteger(session.pre?.[`q${q}`]) && Number.isInteger(session.post?.[`q${q}`])
    ));
  }

  function correctCodesFor(session) {
    return Number(session.surveyAnswerVersion || 1) >= SURVEY_ANSWER_VERSION
      ? CORRECT_CODES
      : LEGACY_CORRECT_CODES;
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderStatistics() {
    const totalExperiences = sessions.reduce((sum, session) => sum + Number(session.experienceCount || 0), 0);
    const speedCounts = Object.fromEntries(SPEEDS.filter((speed) => speed !== 50).map((speed) => [speed, 0]));
    sessions.forEach((session) => (session.experiencedSpeeds || []).forEach((speed) => {
      if (Number(speed) !== 50 && speedCounts[Number(speed)] !== undefined) speedCounts[Number(speed)] += 1;
    }));
    const popular = Object.entries(speedCounts).sort((a, b) => b[1] - a[1])[0];
    const popularText = popular && popular[1] > 0 ? `${popular[0]}km/h` : '-';
    document.getElementById('adminStatCards').innerHTML = `
      <article><span>총 체험 인원</span><strong>${sessions.length}<small>명</small></strong></article>
      <article><span>총 체험 횟수</span><strong>${totalExperiences}<small>회</small></strong></article>
      <article><span>가장 많이 선택한 추가 속도</span><strong>${popularText}</strong></article>`;

    const completed = completedSurveySessions();
    const questionStats = [1, 2, 3].map((q) => {
      const key = `q${q}`;
      const preCorrect = completed.filter((session) => session.pre[key] === correctCodesFor(session)[key]).length;
      const postCorrect = completed.filter((session) => session.post[key] === correctCodesFor(session)[key]).length;
      const preRate = percent(preCorrect, completed.length);
      const postRate = percent(postCorrect, completed.length);
      const distribution = (type) => [1, 2, 3, 4].map((answer) =>
        percent(completed.filter((session) => session[type][key] === answer).length, completed.length)
      );
      return { q, preRate, postRate, change: postRate - preRate, preDistribution: distribution('pre'), postDistribution: distribution('post') };
    });
    const totalAnswers = completed.length * 3;
    const preTotalCorrect = completed.reduce((sum, session) => {
      const codes = correctCodesFor(session);
      return sum + [1, 2, 3].filter((q) => session.pre[`q${q}`] === codes[`q${q}`]).length;
    }, 0);
    const postTotalCorrect = completed.reduce((sum, session) => {
      const codes = correctCodesFor(session);
      return sum + [1, 2, 3].filter((q) => session.post[`q${q}`] === codes[`q${q}`]).length;
    }, 0);
    const preOverall = percent(preTotalCorrect, totalAnswers);
    const postOverall = percent(postTotalCorrect, totalAnswers);
    const signed = (value) => `${value >= 0 ? '+' : ''}${value}%p`;
    document.getElementById('surveyStats').innerHTML = `
      <div class="overall-stat"><span>전체 평균 정답률</span><div><b>체험 전 ${preOverall}%</b><i>→</i><b>체험 후 ${postOverall}%</b><strong>${signed(postOverall - preOverall)}</strong></div><small>사전·사후를 모두 완료한 ${completed.length}개 세션 기준</small></div>
      <div class="question-stat-grid">${questionStats.map((item) => `
        <article class="question-stat"><h4>문항 ${item.q}</h4><p><span>사전 정답률 ${item.preRate}%</span><i>→</i><span>사후 정답률 ${item.postRate}%</span><strong>${signed(item.change)}</strong></p>
          <details><summary>응답 분포 자세히 보기</summary><div class="distribution"><b>체험 전</b><span>${item.preDistribution.map((rate, index) => ` ${index + 1}번 ${rate}%`).join(' ·')}</span><b>체험 후</b><span>${item.postDistribution.map((rate, index) => ` ${index + 1}번 ${rate}%`).join(' ·')}</span></div></details>
        </article>`).join('')}</div>`;

    const maxCount = Math.max(1, ...Object.values(speedCounts));
    document.getElementById('adminSpeedBars').innerHTML = Object.entries(speedCounts).map(([speed, count]) => `
      <div class="admin-speed-bar"><span>${speed}km/h</span><i><b style="width:${count / maxCount * 100}%"></b></i><strong>${count}회</strong></div>`).join('');
  }

  function renderSessionTable() {
    const body = document.getElementById('sessionTableBody');
    body.innerHTML = sessions.length ? [...sessions].reverse().map((session) => {
      const surveyComplete = [1, 2, 3].every((q) => session.pre?.[`q${q}`] && session.post?.[`q${q}`]);
      return `<tr><th scope="row">${session.sessionId}</th><td>${formatDate(session.datetime)}</td><td>${(session.experiencedSpeeds || []).join(', ')}</td><td>${session.experienceCount}</td><td>${surveyComplete ? '완료' : '미사용'}</td></tr>`;
    }).join('') : '<tr><td colspan="5">저장된 체험 기록이 없습니다.</td></tr>';
  }

  function renderSettings() {
    document.getElementById('settingSurvey').checked = settings.surveyEnabled;
    document.getElementById('settingSound').checked = settings.soundEnabled;
    document.getElementById('settingAutoReturn').checked = settings.autoReturn;
    document.getElementById('adminSpeedOptions').innerHTML = SPEEDS.map((speed) => `
      <label><input type="checkbox" value="${speed}" ${settings.availableSpeeds.includes(speed) ? 'checked' : ''} ${speed === 50 ? 'disabled' : ''}><span>${speed}</span><small>km/h</small></label>`).join('');
  }

  function showTab(id) {
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === id));
    document.querySelectorAll('[data-admin-tab]').forEach((button) => button.classList.toggle('active', button.dataset.adminTab === id));
    if (id === 'adminStats') renderStatistics();
    if (id === 'adminData') renderSessionTable();
    window.scrollTo(0, 0);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildCsv() {
    const headers = ['session_id', 'datetime', 'survey_answer_version', 'pre_q1', 'pre_q2', 'pre_q3', 'post_q1', 'post_q2', 'post_q3', 'experienced_speeds', 'experience_count', 'experience_results_json'];
    const rows = sessions.map((session) => [
      session.sessionId, session.datetime, session.surveyAnswerVersion || 1, session.pre?.q1, session.pre?.q2, session.pre?.q3,
      session.post?.q1, session.post?.q2, session.post?.q3,
      (session.experiencedSpeeds || []).join('|'), session.experienceCount, JSON.stringify(session.experiences || [])
    ]);
    return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  function downloadCsv() {
    const csv = buildCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `stopping-distance-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function initialize(options) {
    showScreen = options.showScreen;
    saveSettings();
    renderSettings();

    document.getElementById('adminBtn').addEventListener('click', () => {
      document.getElementById('adminPassword').value = '';
      document.getElementById('adminLoginError').textContent = '';
      showScreen('adminLogin');
    });
    document.getElementById('adminLoginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      if (document.getElementById('adminPassword').value !== INITIAL_ADMIN_PASSWORD) {
        document.getElementById('adminLoginError').textContent = '비밀번호가 맞지 않습니다.';
        return;
      }
      showTab('adminSurveySettings');
      showScreen('admin');
    });
    document.getElementById('adminLoginHomeBtn').addEventListener('click', () => showScreen('intro'));
    document.getElementById('adminHomeBtn').addEventListener('click', () => showScreen('intro'));
    document.querySelector('.admin-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-admin-tab]');
      if (button) showTab(button.dataset.adminTab);
    });
    document.getElementById('settingSurvey').addEventListener('change', (event) => { settings.surveyEnabled = event.target.checked; saveSettings(); });
    document.getElementById('settingSound').addEventListener('change', (event) => { settings.soundEnabled = event.target.checked; saveSettings(); });
    document.getElementById('settingAutoReturn').addEventListener('change', (event) => { settings.autoReturn = event.target.checked; saveSettings(); });
    document.getElementById('adminSpeedOptions').addEventListener('change', () => {
      settings.availableSpeeds = [...document.querySelectorAll('#adminSpeedOptions input:checked')].map((input) => Number(input.value));
      if (!settings.availableSpeeds.includes(50)) settings.availableSpeeds.push(50);
      saveSettings();
    });
    document.getElementById('csvBtn').addEventListener('click', downloadCsv);
    document.getElementById('deleteDataBtn').addEventListener('click', () => {
      if (!window.confirm('저장된 모든 체험 기록을 삭제할까요?')) return;
      if (!window.confirm('삭제한 데이터는 복구할 수 없습니다. 정말 삭제하시겠습니까?')) return;
      sessions = [];
      saveSessions();
      renderSessionTable();
      renderStatistics();
    });
    document.getElementById('resetSettingsBtn').addEventListener('click', () => {
      if (!window.confirm('모든 설정을 기본값으로 되돌릴까요?')) return;
      settings = { ...DEFAULT_SETTINGS, availableSpeeds: [...SPEEDS] };
      saveSettings();
      renderSettings();
    });
  }

  window.AdminModule = {
    initialize,
    beginSession,
    completeSession,
    getSettings: () => ({ ...settings, availableSpeeds: [...settings.availableSpeeds] }),
    getSessions: () => sessions.map((session) => JSON.parse(JSON.stringify(session))),
    createCsv: buildCsv,
    storageKeys: { settings: SETTINGS_KEY, sessions: SESSIONS_KEY }
  };
})();
