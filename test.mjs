// Unit tests for the one-player-per-device feature
// Run with: node test.mjs

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

// ── Mock localStorage ───────────────────────
class MockLocalStorage {
  constructor() { this._store = {}; }
  getItem(k)    { return this._store[k] ?? null; }
  setItem(k, v) { this._store[k] = String(v); }
  removeItem(k) { delete this._store[k]; }
  clear()       { this._store = {}; }
}

// ── Isolated module ─────────────────────────
function makeModule(storage) {
  function getLockedName() { return storage.getItem('marioPlayerName') || null; }
  function setLockedName(name) { storage.setItem('marioPlayerName', name); }
  function resetLockedName() { storage.removeItem('marioPlayerName'); }
  return { getLockedName, setLockedName, resetLockedName };
}

// ── Mock insertScore ─────────────────────────
function makeMockInsert() {
  const calls = [];
  async function insertScore(name, coins) { calls.push({ name, coins }); }
  return { insertScore, calls };
}

// ── Simulate endGame decision (matches new flow) ──
function simulateEndGame(storage) {
  const { getLockedName } = makeModule(storage);
  const lockedName = getLockedName();
  if (lockedName) {
    return { showOverlay: false, silentSaveName: lockedName };
  } else {
    return { showOverlay: true, silentSaveName: null };
  }
}

// ── Simulate first-time saveScore ───────────
async function simulateSaveScore(storage, mockInsert, inputName, pendingScore) {
  const { setLockedName } = makeModule(storage);
  const name = inputName.trim().toUpperCase() || 'AAA';
  await mockInsert.insertScore(name, pendingScore);
  setLockedName(name);
  return name;
}

// ════════════════════════════════════════════
console.log('\n── Test Suite: One-player-per-device ──\n');

// Test 1: First visit — overlay shown, no silent save
{
  const storage = new MockLocalStorage();
  const result = simulateEndGame(storage);
  assert('First visit: overlay is shown', result.showOverlay === true);
  assert('First visit: no silent save triggered', result.silentSaveName === null);
}

// Test 2: After first save, name is locked in storage
{
  const storage = new MockLocalStorage();
  const mock = makeMockInsert();
  const { getLockedName } = makeModule(storage);
  await simulateSaveScore(storage, mock, 'Mario', 8);
  assert('After first save: name stored', getLockedName() === 'MARIO');
  assert('After first save: insertScore was called once', mock.calls.length === 1);
  assert('After first save: correct name sent to DB', mock.calls[0].name === 'MARIO');
}

// Test 3: Returning player — NO overlay, silent save used
{
  const storage = new MockLocalStorage();
  storage.setItem('marioPlayerName', 'MARIO');
  const result = simulateEndGame(storage);
  assert('Returning player: overlay is NOT shown', result.showOverlay === false);
  assert('Returning player: silent save uses locked name', result.silentSaveName === 'MARIO');
}

// Test 4: Silent save always uses locked name, ignores any input
{
  const storage = new MockLocalStorage();
  storage.setItem('marioPlayerName', 'LUIGI');
  const mock = makeMockInsert();
  const { getLockedName } = makeModule(storage);
  const nameToSave = getLockedName(); // what silentSave() does
  await mock.insertScore(nameToSave, 12);
  assert('Silent save: uses locked name not any input', mock.calls[0].name === 'LUIGI');
  assert('Silent save: correct score', mock.calls[0].coins === 12);
}

// Test 5: Returning player cannot change name mid-game
{
  const storage = new MockLocalStorage();
  storage.setItem('marioPlayerName', 'PEACH');
  const result = simulateEndGame(storage);
  // Even if there were an input field, endGame never shows it for returning players
  assert('Returning player: overlay never opens (no chance to change name)', result.showOverlay === false);
  assert('Returning player: name is fixed as PEACH', result.silentSaveName === 'PEACH');
}

// Test 6: Reset clears name, next game shows overlay again
{
  const storage = new MockLocalStorage();
  storage.setItem('marioPlayerName', 'TOAD');
  const { getLockedName, resetLockedName } = makeModule(storage);
  resetLockedName();
  assert('After reset: no locked name', getLockedName() === null);
  const result = simulateEndGame(storage);
  assert('After reset: overlay shown again for name entry', result.showOverlay === true);
}

// Test 7: Empty name input falls back to AAA
{
  const storage = new MockLocalStorage();
  const mock = makeMockInsert();
  await simulateSaveScore(storage, mock, '   ', 5);
  assert('Empty name defaults to AAA', mock.calls[0].name === 'AAA');
}

// Test 8: Name is uppercased
{
  const storage = new MockLocalStorage();
  const mock = makeMockInsert();
  await simulateSaveScore(storage, mock, 'bowser', 3);
  assert('Name is uppercased on save', mock.calls[0].name === 'BOWSER');
}

// Test 9: Multiple games as returning player — each game saves once
{
  const storage = new MockLocalStorage();
  storage.setItem('marioPlayerName', 'WARIO');
  const mock = makeMockInsert();
  const { getLockedName } = makeModule(storage);
  // Simulate 3 games
  for (let i = 0; i < 3; i++) {
    const name = getLockedName();
    await mock.insertScore(name, (i + 1) * 5);
  }
  assert('3 games: 3 inserts total', mock.calls.length === 3);
  assert('All inserts use same name', mock.calls.every(c => c.name === 'WARIO'));
  assert('Scores recorded correctly', mock.calls.map(c => c.coins).join(',') === '5,10,15');
}

// Test 10: New player sees overlay exactly once, then never again
{
  const storage = new MockLocalStorage();
  const mock = makeMockInsert();

  // Game 1 — no name stored yet
  const game1 = simulateEndGame(storage);
  assert('Game 1: overlay shown for new player', game1.showOverlay === true);

  // User enters name and saves
  await simulateSaveScore(storage, mock, 'YOSHI', 7);

  // Game 2 — name now locked
  const game2 = simulateEndGame(storage);
  assert('Game 2: overlay NOT shown for returning player', game2.showOverlay === false);

  // Game 3 — still locked
  const game3 = simulateEndGame(storage);
  assert('Game 3: still no overlay', game3.showOverlay === false);
}

// ── Summary ─────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
