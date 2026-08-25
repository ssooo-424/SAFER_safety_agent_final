const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { normalizeTurnTimings } = require('../runtime/turnTiming');

function loadClientTracker() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'safer', 'turn-timing.js'),
    'utf8',
  );
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.SaferTurnTiming;
}

test('turn dwell timing excludes time while the page is hidden', () => {
  const timing = loadClientTracker();
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    addEventListener: (name, listener) => listeners.set(name, listener),
  };
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  let mono = 0;
  let wall = Date.parse('2026-08-25T01:00:00.000Z');
  const tracker = timing.createTurnTimingTracker({
    documentRef,
    storage,
    monotonicNow: () => mono,
    wallNow: () => wall,
  });

  tracker.start('turn2');
  mono += 5_000;
  wall += 5_000;
  documentRef.hidden = true;
  listeners.get('visibilitychange')();
  mono += 10_000;
  wall += 10_000;
  documentRef.hidden = false;
  listeners.get('visibilitychange')();
  mono += 3_000;
  wall += 3_000;
  const result = tracker.complete('quick_reply');

  assert.equal(result.activeMs, 8_000);
  assert.equal(result.hiddenMs, 10_000);
  assert.equal(result.totalMs, 18_000);
  assert.equal(result.completionAction, 'quick_reply');
  assert.equal(
    JSON.stringify(tracker.snapshot()),
    JSON.stringify({ turn2: result }),
  );
});

test('server timing normalization accepts bounded stages and rejects impossible values', () => {
  const normalized = normalizeTurnTimings({
    turn0: {
      activeMs: 8_400,
      totalMs: 9_000,
      hiddenMs: 600,
      startedAt: '2026-08-25T01:00:00.000Z',
      completedAt: '2026-08-25T01:00:09.000Z',
      completionAction: 'quick_reply',
    },
    turn1: { activeMs: 20_000, totalMs: 10_000, hiddenMs: 0 },
    unknown: { activeMs: 1, totalMs: 1, hiddenMs: 0 },
  });

  assert.equal(normalized.turn0.activeMs, 8_400);
  assert.equal(normalized.turn0.hiddenMs, 600);
  assert.equal(normalized.turn0.completionAction, 'quick_reply');
  assert.equal(normalized.turn1, undefined);
  assert.equal(normalized.unknown, undefined);
});
