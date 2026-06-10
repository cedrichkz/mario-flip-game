const DURATION = 15;
let score = 0;
let flipping = false;
let gameActive = false;
let timeLeft = DURATION;
let timerInterval = null;
let pendingScore = 0;

// ── Persist scores ─────────────────────────
function loadScores() {
  try { return JSON.parse(localStorage.getItem('marioScores') || '[]'); }
  catch { return []; }
}

function saveScores(arr) {
  localStorage.setItem('marioScores', JSON.stringify(arr));
}

// ── Render table ────────────────────────────
function renderTable(highlightIndex = -1) {
  const scores = loadScores();
  const tbody = document.getElementById('hsBody');

  if (scores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="hs-empty">NO SCORES YET — BE THE FIRST!</td></tr>';
    return;
  }

  tbody.innerHTML = scores.map((s, i) => {
    const medals = ['🥇', '🥈', '🥉'];
    const rankText = i < 3 ? medals[i] : `#${i + 1}`;
    const isNew = i === highlightIndex;
    return `<tr class="rank-${i + 1}${isNew ? ' hs-new' : ''}">
      <td class="rank">${rankText}</td>
      <td>${s.name}</td>
      <td class="score-col">${s.coins}</td>
      <td>${s.date}</td>
    </tr>`;
  }).join('');

  document.getElementById('bestDisplay').textContent = scores[0].coins;
}

// ── Sound ───────────────────────────────────
function playCoinSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(987.77, now);
  osc.frequency.setValueAtTime(1318.51, now + 0.08);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}

function playTimeUpSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;
  [659, 523, 392, 330].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, now + i * 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.13);
    osc.start(now + i * 0.14);
    osc.stop(now + i * 0.14 + 0.13);
  });
}

// ── Sparkles ────────────────────────────────
function spawnSparkles(x, y) {
  const emojis = ['✨', '⭐', '💛', '🌟'];
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle = (Math.PI * 2 / 6) * i;
    const dist = 60 + Math.random() * 40;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Timer ───────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    const display = document.getElementById('timerDisplay');
    display.textContent = timeLeft;
    display.className = 'hud-value' + (timeLeft <= 10 ? ' timer-warn' : '');
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// ── Game flow ───────────────────────────────
function startGame() {
  score = 0;
  timeLeft = DURATION;
  gameActive = true;
  flipping = false;

  document.getElementById('scoreNum').textContent = '0';
  document.getElementById('timerDisplay').textContent = DURATION;
  document.getElementById('timerDisplay').className = 'hud-value';
  document.getElementById('subtext').textContent = 'GO GO GO! HIT THE BLOCK!';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('hitBtn').style.display = 'inline-block';
  document.getElementById('hitBtn').disabled = false;
  document.getElementById('block').classList.remove('spent');

  startTimer();
}

function endGame() {
  clearInterval(timerInterval);
  gameActive = false;
  pendingScore = score;

  document.getElementById('hitBtn').disabled = true;
  document.getElementById('subtext').textContent = "TIME'S UP!";

  playTimeUpSound();

  setTimeout(() => {
    document.getElementById('finalScore').textContent = pendingScore;
    document.getElementById('nameInput').value = '';
    document.getElementById('overlay').classList.add('show');
    document.getElementById('nameInput').focus();
  }, 600);
}

function saveScore() {
  const raw = document.getElementById('nameInput').value.trim().toUpperCase();
  const name = raw || 'AAA';
  const scores = loadScores();
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  scores.push({ name, coins: pendingScore, date });
  scores.sort((a, b) => b.coins - a.coins);
  if (scores.length > 20) scores.length = 20;
  const newIndex = scores.findIndex(s => s.name === name && s.coins === pendingScore && s.date === date);
  saveScores(scores);
  closeOverlay();
  renderTable(newIndex);
  document.getElementById('startBtn').style.display = 'inline-block';
  document.getElementById('hitBtn').style.display = 'none';
  document.getElementById('subtext').textContent = 'PRESS START — BEAT THE CLOCK!';
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('startBtn').style.display = 'inline-block';
  document.getElementById('hitBtn').style.display = 'none';
  document.getElementById('subtext').textContent = 'PRESS START — BEAT THE CLOCK!';
}

// ── Flip ────────────────────────────────────
function handleFlip() {
  if (!gameActive || flipping) return;
  flipping = true;

  playCoinSound();

  const block = document.getElementById('block');
  block.classList.remove('bump');
  void block.offsetWidth;
  block.classList.add('bump');

  const coin = document.getElementById('coin');
  coin.classList.remove('flip');
  void coin.offsetWidth;
  coin.classList.add('flip');

  const pop = document.getElementById('scorePop');
  pop.classList.remove('animate');
  void pop.offsetWidth;
  pop.classList.add('animate');

  const rect = block.getBoundingClientRect();
  spawnSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2);

  score++;
  document.getElementById('scoreNum').textContent = score;

  coin.addEventListener('animationend', () => {
    coin.classList.remove('flip');
    flipping = false;
  }, { once: true });
}

// ── Keyboard ────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!gameActive) {
      if (!document.getElementById('overlay').classList.contains('show')) startGame();
    } else {
      handleFlip();
    }
  }
  if (e.code === 'Escape') closeOverlay();
});

document.getElementById('nameInput').addEventListener('keydown', (e) => {
  if (e.code === 'Enter') saveScore();
});

// ── Init ────────────────────────────────────
renderTable();
