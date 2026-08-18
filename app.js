(() => {
  'use strict';

  const DECELERATION = 3.4;
  const REFERENCE_REACTION_TIME = 2.5;
  const BRAKING_DURATION = 2000;
  const SPEEDS = [30, 40, 50, 60, 70, 80, 90, 100];
  const REFERENCE_STOPPING_DISTANCE = {
    30: 31.2, 40: 46.2, 50: 63.4, 60: 83.0,
    70: 104.9, 80: 129.0, 90: 155.5, 100: 184.2
  };

  const screens = [...document.querySelectorAll('.screen')];
  const $ = (id) => document.getElementById(id);
  const scene = $('scene');
  const crate = $('crate');
  const experiences = [];
  const screenHistory = [];
  let currentSpeed = 50;
  let state = 'intro';
  let obstacleTimer = null;
  let reactionStart = null;
  let reactionSeconds = 0;
  let runToken = 0;
  let sessionSaved = false;
  let autoReturnTimer = null;

  function show(id, recordHistory = true) {
    if (id === state) return;
    const currentScreen = document.getElementById(state);
    if (recordHistory && currentScreen?.classList.contains('screen')) screenHistory.push(state);
    if (id === 'intro') screenHistory.length = 0;
    screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
    state = id;
    $('backBtn').classList.toggle('visible', !['intro', 'drive'].includes(id));
    window.scrollTo(0, 0);
  }

  function goToPreviousScreen() {
    if (state === 'surveyQuestion' && window.SurveyModule.goBack()) return;
    let previous = screenHistory.pop();
    while (previous && !document.getElementById(previous)?.classList.contains('screen')) previous = screenHistory.pop();
    if (!previous) return;
    if (previous === 'surveyQuestion') {
      state = previous;
      screens.forEach((screen) => screen.classList.toggle('active', screen.id === previous));
      $('backBtn').classList.add('visible');
      window.SurveyModule.resume();
      return;
    }
    show(previous, false);
  }

  window.SurveyModule.initialize({ showScreen: show });
  window.InstructorModule.initialize({ showScreen: show });
  window.AdminModule.initialize({ showScreen: show });

  function setAnimationRate(animation, rate) {
    if (typeof animation.updatePlaybackRate === 'function') animation.updatePlaybackRate(rate);
    else animation.playbackRate = rate;
  }

  function configureGuide(speed, isFirst = false) {
    currentSpeed = speed;
    $('guideEyebrow').textContent = isFirst ? '첫 번째 체험' : `${experiences.length + 1}번째 체험`;
    $('guideLead').textContent = isFirst ? '먼저' : '이번에는';
    $('guideSpeed').textContent = speed;
    $('guideEnding').textContent = isFirst ? '달려볼게요.' : '갑니다.';
  }

  function baseMotionDuration() {
    return 1.25 * 50 / currentSpeed;
  }

  function startRun() {
    runToken += 1;
    const token = runToken;
    clearTimeout(obstacleTimer);
    reactionStart = null;
    reactionSeconds = 0;
    crate.className = 'crate';
    scene.classList.remove('braking');
    $('car').style.left = '';
    $('brakingMeasure').classList.remove('visible', 'stopped');
    $('brakingTrail').style.width = '0px';
    $('stopMarker').style.left = '0px';
    const motionDuration = baseMotionDuration();
    scene.style.setProperty('--motion-speed', `${motionDuration}s`);
    scene.style.setProperty('--tree-motion-speed', `${motionDuration * 2}s`);
    scene.style.setProperty('--far-motion-speed', `${motionDuration * 3}s`);
    document.querySelectorAll('.wheel').forEach((wheel) => {
      wheel.style.animationDuration = `${0.5 * 50 / currentSpeed}s`;
    });
    $('speedValue').textContent = currentSpeed;
    $('driveMessage').textContent = '';
    show('drive');
    requestAnimationFrame(() => {
      document.querySelectorAll('.skyline, .trees, .lane-marks, .wheel').forEach((element) => {
        element.getAnimations().forEach((animation) => {
          animation.play();
          setAnimationRate(animation, 1);
        });
      });
    });
    obstacleTimer = setTimeout(() => dropObstacle(token), 3000 + Math.random() * 3000);
  }

  function dropObstacle(token) {
    if (state !== 'drive' || token !== runToken) return;
    crate.classList.add('dropping');
    crate.addEventListener('animationend', () => {
      if (state === 'drive' && token === runToken) reactionStart = performance.now();
    }, { once: true });
  }

  function brake() {
    if (state !== 'drive') return;
    if (reactionStart === null) {
      $('driveMessage').textContent = '장애물이 나타나면 브레이크 버튼을 눌러주세요.';
      setTimeout(() => { if (state === 'drive') $('driveMessage').textContent = ''; }, 1400);
      return;
    }
    reactionSeconds = Math.max(0, (performance.now() - reactionStart) / 1000);
    reactionStart = null;
    state = 'braking';
    $('brakingMeasure').classList.add('visible');
    playBrakeSound();
    animateBraking();
  }

  function playBrakeSound() {
    if (!window.AdminModule.getSettings().soundEnabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.28);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.33);
      oscillator.addEventListener('ended', () => context.close());
    } catch (_) {
      // 오디오 미지원 환경에서도 핵심 체험은 그대로 작동한다.
    }
  }

  function animateBraking() {
    const started = performance.now();
    const car = $('car');
    const sceneRect = scene.getBoundingClientRect();
    const carRect = car.getBoundingClientRect();
    const startCenter = carRect.left - sceneRect.left + carRect.width / 2;
    const targetCenter = scene.clientWidth * (scene.clientWidth <= 640 ? 0.48 : 0.52);
    const maxTravel = Math.max(0, targetCenter - startCenter);
    $('brakingMeasure').style.left = `${startCenter}px`;
    const motionAnimations = [...document.querySelectorAll('.skyline, .trees, .lane-marks, .wheel')]
      .flatMap((element) => element.getAnimations());
    let previousCenter = startCenter;

    function frame(now) {
      const progress = Math.min(1, (now - started) / BRAKING_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      const speed = Math.round(currentSpeed * (1 - eased));
      $('speedValue').textContent = speed;
      motionAnimations.forEach((animation) => setAnimationRate(animation, Math.max(0.02, 1 - eased)));
      const nextCenter = Math.max(previousCenter, startCenter + maxTravel * eased);
      previousCenter = nextCenter;
      const travelled = nextCenter - startCenter;
      car.style.left = `${nextCenter}px`;
      $('brakingTrail').style.width = `${travelled}px`;
      $('stopMarker').style.left = `${travelled}px`;
      if (progress < 1) requestAnimationFrame(frame);
      else {
        scene.classList.add('braking');
        $('brakingMeasure').classList.add('stopped');
        setTimeout(showResult, 900);
      }
    }
    requestAnimationFrame(frame);
  }

  function distances(reaction, speed = currentSpeed) {
    const reactionDistance = 0.278 * speed * reaction;
    const brakingDistance = 0.039 * speed * speed / DECELERATION;
    return { reactionDistance, brakingDistance, total: reactionDistance + brakingDistance };
  }

  function showResult() {
    const values = distances(reactionSeconds, currentSpeed);
    const result = {
      speed: currentSpeed,
      reactionTime: reactionSeconds,
      reactionDistance: values.reactionDistance,
      brakingDistance: values.brakingDistance,
      stoppingDistance: values.total,
      order: experiences.length + 1
    };
    experiences.push(result);
    const firstExperience = experiences.length === 1;
    $('result').classList.toggle('repeat-result', !firstExperience);
    $('resultStatus').textContent = firstExperience ? '자동차가 완전히 멈췄습니다' : `${currentSpeed}km/h에서`;
    $('resultDescription').innerHTML = firstExperience
      ? '위험을 발견한 순간부터<br>완전히 멈출 때까지 이동한 거리'
      : '이동한 뒤 멈췄습니다.';
    $('resultMeaning').hidden = !firstExperience;
    $('detailBtn').textContent = firstExperience ? '정지거리 자세히 보기' : '내 체험 결과 확인하기';
    $('reactionTime').textContent = reactionSeconds.toFixed(2);
    $('totalDistance').textContent = values.total.toFixed(1);
    $('resultRoadDistance').textContent = values.total.toFixed(1);
    $('reactionDistance').textContent = values.reactionDistance.toFixed(1);
    $('brakingDistance').textContent = values.brakingDistance.toFixed(1);
    $('detailTotal').textContent = values.total.toFixed(1);
    $('endCaption').textContent = `${values.total.toFixed(1)}m`;
    const reactionPercent = values.total ? values.reactionDistance / values.total * 100 : 0;
    $('reactionSegment').style.width = `${reactionPercent}%`;
    $('brakingSegment').style.width = `${100 - reactionPercent}%`;
    $('brakePoint').style.left = `${reactionPercent}%`;
    $('brakeCaption').style.left = `${Math.max(12, Math.min(88, reactionPercent))}%`;
    $('restartBtn').textContent = experiences.length === 1 ? '다른 속도로 체험하기' : '두 속도 비교하기';
    show('result');
  }

  function updateSpeedSelection() {
    const completed = new Set(experiences.map((item) => item.speed));
    const choosingSecond = experiences.length === 1;
    const availableSpeeds = window.AdminModule.getSettings().availableSpeeds;
    document.querySelectorAll('#speedGrid button').forEach((button) => {
      const speed = Number(button.dataset.speed);
      const done = completed.has(speed);
      button.hidden = !availableSpeeds.includes(speed);
      button.classList.toggle('completed', done);
      button.disabled = choosingSecond && speed === 50;
      button.querySelector('span').textContent = done ? 'km/h · 체험 완료 ✓' : 'km/h';
    });
    $('selectionHint').textContent = choosingSecond
      ? '첫 체험 속도인 50km/h는 다른 속도와 비교하기 위해 선택할 수 없습니다.'
      : '✓ 표시는 이미 체험한 속도입니다. 자유롭게 다시 선택할 수 있어요.';
  }

  function openSpeedSelection() {
    updateSpeedSelection();
    show('speedSelect');
  }

  function showComparison() {
    if (experiences.length < 2) return openSpeedSelection();
    const first = experiences[0];
    const latest = experiences[experiences.length - 1];
    const rows = [first, latest].map((item) => ({
      speed: item.speed,
      distance: REFERENCE_STOPPING_DISTANCE[item.speed]
    }));
    const maxDistance = Math.max(...rows.map((row) => row.distance));
    $('standardNote').textContent = `두 속도 모두 기준 반응시간 ${REFERENCE_REACTION_TIME}초 · 감속도 ${DECELERATION}m/s²`;
    $('compareBars').innerHTML = rows.map((row) => `
      <div class="compare-row">
        <div class="compare-row-head"><strong>${row.speed} km/h</strong><span>${row.distance.toFixed(1)}m</span></div>
        <div class="compare-axis"><i style="width:${(row.distance / maxDistance * 100).toFixed(3)}%"></i></div>
      </div>`).join('');
    const lowerSpeed = Math.min(first.speed, latest.speed);
    const higherSpeed = Math.max(first.speed, latest.speed);
    const speedRatio = higherSpeed / lowerSpeed;
    const distanceRatio = REFERENCE_STOPPING_DISTANCE[higherSpeed] / REFERENCE_STOPPING_DISTANCE[lowerSpeed];
    const formatMultiplier = (value) => value.toFixed(1).replace(/\.0$/, '');
    const speedApproximation = Number.isInteger(speedRatio) ? '' : '약 ';
    $('speedDifference').textContent = Math.abs(latest.speed - first.speed);
    $('distanceDifference').textContent = Math.abs(
      REFERENCE_STOPPING_DISTANCE[latest.speed] - REFERENCE_STOPPING_DISTANCE[first.speed]
    ).toFixed(1);
    $('ratioCopy').innerHTML = `<span><small>속도</small><strong>${speedApproximation}${formatMultiplier(speedRatio)}배</strong></span><i aria-hidden="true">↓</i><span><small>정지거리</small><strong>약 ${formatMultiplier(distanceRatio)}배</strong></span>`;
    show('compare');
  }

  function showPersonalResults() {
    $('personalList').innerHTML = experiences.map((item) => `
      <article class="personal-card">
        <h3>${item.order}번째 체험 · ${item.speed} km/h</h3>
        <div class="personal-stopping-distance">
          <strong>${item.stoppingDistance.toFixed(1)}m</strong>
          <span>정지거리</span>
        </div>
        <dl>
          <div><dt>공주거리</dt><dd>${item.reactionDistance.toFixed(1)}m</dd></div>
          <div><dt>제동거리</dt><dd>${item.brakingDistance.toFixed(1)}m</dd></div>
        </dl>
        <p>반응시간 ${item.reactionTime.toFixed(2)}초</p>
      </article>`).join('');
    show('personal');
  }

  function resetExperience() {
    clearTimeout(autoReturnTimer);
    experiences.length = 0;
    window.SurveyModule.reset();
    sessionSaved = false;
    configureGuide(50, true);
    show('intro');
  }

  function scheduleAutoReturn() {
    clearTimeout(autoReturnTimer);
    const adminSettings = window.AdminModule.getSettings();
    if (!adminSettings.autoReturn) return;
    autoReturnTimer = setTimeout(resetExperience, adminSettings.autoReturnSeconds * 1000);
  }

  function finishStudentExperience() {
    if (!sessionSaved) {
      window.AdminModule.completeSession({
        survey: window.SurveyModule.getResults(),
        experiences: experiences.map((item) => ({ ...item }))
      });
      sessionSaved = true;
    }
    show('complete');
    scheduleAutoReturn();
  }

  $('enterBtn').addEventListener('click', () => {
    window.AdminModule.beginSession();
    sessionSaved = false;
    if (window.SurveyModule.isEnabled()) show('preSurveyIntro');
    else {
      configureGuide(50, true);
      show('guide');
    }
  });
  $('backBtn').addEventListener('click', goToPreviousScreen);
  $('preSurveyStartBtn').addEventListener('click', () => {
    window.SurveyModule.start('pre', () => {
      configureGuide(50, true);
      show('guide');
    });
  });
  $('postSurveyStartBtn').addEventListener('click', () => {
    window.SurveyModule.start('post', () => show('learningSummary'));
  });
  $('startBtn').addEventListener('click', startRun);
  $('brakeBtn').addEventListener('click', brake);
  $('detailBtn').addEventListener('click', () => {
    if (experiences.length === 1) show('detail');
    else showPersonalResults();
  });
  $('restartBtn').addEventListener('click', () => {
    if (experiences.length === 1) openSpeedSelection();
    else showComparison();
  });
  $('speedGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-speed]');
    if (!button || button.disabled) return;
    configureGuide(Number(button.dataset.speed), false);
    show('guide');
  });
  $('personalBtn').addEventListener('click', () => {
    if (window.SurveyModule.isEnabled()) show('postSurveyIntro');
    else finishStudentExperience();
  });
  $('backCompareBtn').addEventListener('click', showComparison);
  $('moreSpeedBtn').addEventListener('click', openSpeedSelection);
  $('learningCompleteBtn').addEventListener('click', finishStudentExperience);
  $('homeBtn').addEventListener('click', resetExperience);
  $('complete').addEventListener('pointerdown', (event) => {
    if (event.target !== $('homeBtn')) scheduleAutoReturn();
  });
  $('drive').addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') brake();
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && state === 'drive') {
      event.preventDefault();
      brake();
    }
  });

  window.StoppingDistance = {
    calculate: distances,
    referenceReactionTime: REFERENCE_REACTION_TIME,
    referenceDistances: { ...REFERENCE_STOPPING_DISTANCE },
    getExperiences: () => experiences.map((item) => ({ ...item })),
    getSurveyResults: () => window.SurveyModule.getResults()
  };
})();
