(() => {
  'use strict';

  const QUESTIONS = [
    {
      lines: [
        [{ text: '위험을 발견한 순간부터', emphasis: true }],
        [{ text: '차량이 ' }, { text: '완전히 정지하기까지', emphasis: true }, { text: ' 거리에는' }],
        [{ text: '무엇이 포함될까요?' }]
      ],
      choices: [
        '① 브레이크를 밟기 전까지 이동한 거리',
        '② 브레이크를 밟은 뒤 이동한 거리',
        '③ ①과 ②의 거리가 모두 포함된다',
        '④ 잘 모르겠다'
      ]
    },
    {
      lines: [
        [{ text: '같은 조건에서', emphasis: true }, { text: ' 차의 ' }, { text: '속도가 2배 높아지면', emphasis: true }, { text: ',' }],
        [{ text: '완전히 정지하는 데 필요한 거리는 어떻게 될까요?' }]
      ],
      choices: [
        '① 거의 비슷하다',
        '② 2배보다 더 길어진다',
        '③ 약 2배 길어진다',
        '④ 잘 모르겠다'
      ]
    },
    {
      lines: [
        [{ text: '속도가 2배 높아지면', emphasis: true }, { text: ', ' }, { text: '브레이크를 밟은 뒤', emphasis: true }],
        [{ text: '정지하기까지의 거리는 어떻게 될까요?' }]
      ],
      choices: [
        '① 변화가 없다',
        '② 약 2배 길어진다',
        '③ 2배보다 더 길어진다',
        '④ 잘 모르겠다'
      ]
    }
  ];

  // 향후 교수용·관리자용 분석에서만 사용한다. 교육생 질문 화면에는 표시하지 않는다.
  const CORRECT_ANSWER_CODES = { q1: 3, q2: 2, q3: 3 };
  const survey = { pre: {}, post: {} };
  let enabled = true;
  let currentType = 'pre';
  let currentIndex = 0;
  let selecting = false;
  let completionHandler = null;
  let showScreen = null;

  function initialize(options) {
    showScreen = options.showScreen;
  }

  function renderQuestion() {
    const question = QUESTIONS[currentIndex];
    const savedAnswer = survey[currentType][`q${currentIndex + 1}`];
    document.getElementById('surveyCount').textContent = `${currentIndex + 1} / ${QUESTIONS.length}`;
    document.getElementById('survey-question-title').innerHTML = question.lines.map((line) =>
      `<span class="question-line">${line.map((part) => part.emphasis
        ? `<strong class="question-emphasis">${part.text}</strong>`
        : part.text).join('')}</span>`
    ).join('');
    document.getElementById('surveyAnswers').innerHTML = question.choices.map((choice, index) =>
      `<button type="button" data-answer="${index + 1}" class="${savedAnswer === index + 1 ? 'selected' : ''}" aria-pressed="${savedAnswer === index + 1}">${choice}</button>`
    ).join('');
    selecting = false;
    showScreen('surveyQuestion');
  }

  function start(type, onComplete) {
    currentType = type;
    currentIndex = 0;
    completionHandler = onComplete;
    if (!enabled) {
      onComplete();
      return;
    }
    renderQuestion();
  }

  function selectAnswer(button) {
    if (selecting) return;
    selecting = true;
    const answer = Number(button.dataset.answer);
    survey[currentType][`q${currentIndex + 1}`] = answer;
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
    document.querySelectorAll('#surveyAnswers button').forEach((item) => { item.disabled = true; });
    setTimeout(() => {
      if (currentIndex + 1 < QUESTIONS.length) {
        currentIndex += 1;
        renderQuestion();
      } else if (completionHandler) completionHandler();
    }, 500);
  }

  function goBack() {
    if (selecting || currentIndex === 0) return false;
    currentIndex -= 1;
    renderQuestion();
    return true;
  }

  function resume() {
    renderQuestion();
  }

  function reset() {
    survey.pre = {};
    survey.post = {};
    currentIndex = 0;
    selecting = false;
    completionHandler = null;
  }

  function getResults() {
    return {
      pre: { ...survey.pre },
      post: { ...survey.post }
    };
  }

  document.getElementById('surveyAnswers').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-answer]');
    if (button) selectAnswer(button);
  });

  window.SurveyModule = {
    initialize,
    start,
    goBack,
    resume,
    reset,
    getResults,
    isEnabled: () => enabled,
    setEnabled: (value) => { enabled = Boolean(value); },
    questionCount: QUESTIONS.length,
    getCorrectAnswerCodes: () => ({ ...CORRECT_ANSWER_CODES })
  };
})();
