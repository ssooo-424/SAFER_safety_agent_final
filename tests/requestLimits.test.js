const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createConcurrencyGate,
  createFixedWindowLimiter,
} = require('../lib/requestLimits');

test('fixed-window limiter enforces both per-client and global ceilings without evicting active buckets', () => {
  let now = 1_000;
  const limiter = createFixedWindowLimiter({
    windowMs: 10_000,
    maxPerKey: 2,
    maxGlobal: 3,
    maxKeys: 2,
    now: () => now,
  });

  assert.equal(limiter.consume('tablet-a').allowed, true);
  assert.equal(limiter.consume('tablet-a').allowed, true);
  assert.deepEqual(limiter.consume('tablet-a'), { allowed: false, retryAfterSeconds: 10 });
  assert.equal(limiter.consume('tablet-b').allowed, true);
  assert.deepEqual(limiter.consume('tablet-c'), { allowed: false, retryAfterSeconds: 10 });

  now += 10_001;
  assert.equal(limiter.consume('tablet-c').allowed, true);
});

test('concurrency gate returns one idempotent release for each admitted operation', () => {
  const gate = createConcurrencyGate({ maxActive: 1 });
  const first = gate.tryAcquire();

  assert.equal(first.allowed, true);
  assert.deepEqual(gate.tryAcquire(), { allowed: false });
  first.release();
  first.release();

  const second = gate.tryAcquire();
  assert.equal(second.allowed, true);
  second.release();
});
