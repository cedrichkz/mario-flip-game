const SUPABASE_URL = 'https://rlbrlfjejxbpgaevpzsx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsYnJsZmplanhicGdhZXZwenN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODM5OTEsImV4cCI6MjA5NjY1OTk5MX0.P_zgG2ZNd0UyTrKjDv10t9XppToiW0PfEx9DzMW68ek';

const DURATION = 15;
let score = 0;
let flipping = false;
let gameActive = false;
let timeLeft = DURATION;
let timerInterval = null;
let pendingScore = 0;

// ── Locked username ─────────────────────────
function getLockedName() {
  return localStorage.getItem('marioPlayerName') || null;
}

function setLockedName(name) {
  localStorage.setItem('marioPlayerName', name);
  document.getElementById('playerDisplay').textContent = name;
}

function initPlayerDisplay() {
  const name = getLockedName();
  document.getElementById('playerDisplay').textContent = name || '—';
  document.getElementById('playerDisplay').onclick = () => {
    if (confirm('Reset your player name? Your scores will stay on the board.')) {
      localStorage.removeItem('marioPlayerName');
      document.getElementById('playerDisplay').textContent = '—';
    }
  };
}

// ── Supabase helpers ────────────────────────
async function fetchScores() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scores?select=name,coins,created_at&order=coins.desc&limit=20`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.ok ? res.json() : [];
}

async function insertScore(name, coins) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_high_score`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_name: name, p_coins: coins }),
  });
}

// ── Render table ────────────────────────────
async function renderTable(highlightName = null, highlightCoins = null) {
  const tbody = document.getElementById('hsBody');
  tbody.innerHTML = '<tr><td colspan="4" class="hs-empty">LOADING...</td></tr>';

  const scores = await fetchScores();

  if (!scores.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="hs-empty">NO SCORES YET — BE THE FIRST!</td></tr>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  tbody.innerHTML = scores.map((s, i) => {
    const rankText = i < 3 ? medals[i] : `#${i + 1}`;
    const d = new Date(s.created_at);
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const isNew = s.name === highlightName && s.coins === highlightCoins;
    return `<tr class="rank-${i+1}${isNew ? ' hs-new' : ''}">
      <td class="rank">${rankText}</td>
      <td>${s.name}</td>
      <td class="score-col">${s.coins}</td>
      <td>${date}</td>
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

  const lockedName = getLockedName();

  if (lockedName) {
    // Returning player — no overlay, silent background save
    silentSave(lockedName);
  } else {
    // First time — show overlay with name input after short delay
    setTimeout(() => {
      document.getElementById('finalScore').textContent = pendingScore;
      document.getElementById('nameRow').style.display = 'flex';
      document.getElementById('nameInput').value = '';
      document.getElementById('overlay').classList.add('show');
      document.getElementById('nameInput').focus();
    }, 600);
  }
}

async function silentSave(name) {
  const subtext = document.getElementById('subtext');
  subtext.textContent = `SAVING ${name}'S SCORE...`;
  await insertScore(name, pendingScore);
  subtext.textContent = `✓ SAVED AS ${name}! PLAY AGAIN?`;
  document.getElementById('startBtn').style.display = 'inline-block';
  document.getElementById('hitBtn').style.display = 'none';
  renderTable(name, pendingScore);
}

async function saveScore() {
  const raw = document.getElementById('nameInput').value.trim().toUpperCase();
  const name = raw || 'AAA';

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'SAVING...';

  await insertScore(name, pendingScore);
  setLockedName(name);

  saveBtn.disabled = false;
  saveBtn.textContent = 'SAVE SCORE';

  closeOverlay();
  renderTable(name, pendingScore);
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
  // Never intercept keys while the name input is focused
  if (document.activeElement === document.getElementById('nameInput')) return;

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
  if (e.code === 'Enter') { e.preventDefault(); saveScore(); }
});

// ── Init ────────────────────────────────────
initPlayerDisplay();
renderTable();
