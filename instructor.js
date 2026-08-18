(() => {
  'use strict';

  const REFERENCE_DATA = [
    { speed: 30, reaction: 20.9, braking: 10.3, stopping: 31.2 },
    { speed: 40, reaction: 27.8, braking: 18.4, stopping: 46.2 },
    { speed: 50, reaction: 34.8, braking: 28.7, stopping: 63.4 },
    { speed: 60, reaction: 41.7, braking: 41.3, stopping: 83.0 },
    { speed: 70, reaction: 48.7, braking: 56.2, stopping: 104.9 },
    { speed: 80, reaction: 55.6, braking: 73.4, stopping: 129.0 },
    { speed: 90, reaction: 62.6, braking: 92.9, stopping: 155.5 },
    { speed: 100, reaction: 69.5, braking: 114.7, stopping: 184.2 }
  ];

  let showScreen = null;

  function formatMultiplier(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function getData(speed) {
    return REFERENCE_DATA.find((item) => item.speed === Number(speed));
  }

  function renderComparison() {
    const first = getData(document.getElementById('instructorSpeedA').value);
    const second = getData(document.getElementById('instructorSpeedB').value);
    const maxDistance = Math.max(first.stopping, second.stopping);
    document.getElementById('instructorComparison').innerHTML = [first, second].map((item) => `
      <article class="instructor-speed-result">
        <h4>${item.speed} km/h</h4>
        <dl>
          <div><dt>공주거리</dt><dd>${item.reaction.toFixed(1)}m</dd></div>
          <div><dt>제동거리</dt><dd>${item.braking.toFixed(1)}m</dd></div>
          <div class="instructor-total"><dt>정지거리</dt><dd>${item.stopping.toFixed(1)}m</dd></div>
        </dl>
        <div class="instructor-distance-axis" aria-label="${item.speed}km/h 기준 정지거리 ${item.stopping.toFixed(1)}m"><i style="width:${(item.stopping / maxDistance * 100).toFixed(3)}%"></i></div>
      </article>`).join('');

    const lower = first.speed <= second.speed ? first : second;
    const higher = first.speed <= second.speed ? second : first;
    const difference = Math.abs(higher.stopping - lower.stopping);
    const speedRatio = higher.speed / lower.speed;
    const distanceRatio = higher.stopping / lower.stopping;
    document.getElementById('instructorDifference').innerHTML = `
      <h4>차이</h4>
      <p>정지거리 약 <strong>${difference.toFixed(1)}m</strong> 증가</p>
      <div><span>속도 <strong>${formatMultiplier(speedRatio)}배</strong></span><span>정지거리 약 <strong>${formatMultiplier(distanceRatio)}배</strong></span></div>`;
  }

  function showTab(id) {
    document.querySelectorAll('.instructor-panel').forEach((panel) => panel.classList.toggle('active', panel.id === id));
    document.querySelectorAll('[data-instructor-tab]').forEach((button) => {
      const active = button.dataset.instructorTab === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    window.scrollTo(0, 0);
  }

  function initialize(options) {
    showScreen = options.showScreen;
    const choices = REFERENCE_DATA.map((item) => `<option value="${item.speed}">${item.speed} km/h</option>`).join('');
    document.getElementById('instructorSpeedA').innerHTML = choices;
    document.getElementById('instructorSpeedB').innerHTML = choices;
    document.getElementById('instructorSpeedA').value = '50';
    document.getElementById('instructorSpeedB').value = '100';
    document.getElementById('instructorTableBody').innerHTML = REFERENCE_DATA.map((item) => `
      <tr><th scope="row">${item.speed}km/h</th><td>${item.reaction.toFixed(1)}m</td><td>${item.braking.toFixed(1)}m</td><td><strong>${item.stopping.toFixed(1)}m</strong></td></tr>`).join('');
    renderComparison();

    document.getElementById('instructorBtn').addEventListener('click', () => {
      showTab('instructorCompare');
      showScreen('instructor');
    });
    document.getElementById('instructorHomeBtn').addEventListener('click', () => showScreen('intro'));
    document.getElementById('instructorSpeedA').addEventListener('change', renderComparison);
    document.getElementById('instructorSpeedB').addEventListener('change', renderComparison);
    document.querySelector('.instructor-tabs').addEventListener('click', (event) => {
      const button = event.target.closest('[data-instructor-tab]');
      if (button) showTab(button.dataset.instructorTab);
    });
  }

  window.InstructorModule = {
    initialize,
    getReferenceData: () => REFERENCE_DATA.map((item) => ({ ...item }))
  };
})();
