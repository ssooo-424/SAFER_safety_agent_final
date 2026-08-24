const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONDITIONS,
  chooseBalancedCondition,
} = require('../lib/conditionAssignment');

test('chooseBalancedCondition selects a minimum-count condition using the injected random index', () => {
  const condition = chooseBalancedCondition(
    { educator: 4, coworker: 2, future_self: 2 },
    () => 0.75,
  );

  assert.equal(condition, 'future_self');
});

test('nine sequential balanced choices keep every prefix within one assignment', () => {
  const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));

  for (let index = 0; index < 9; index += 1) {
    const condition = chooseBalancedCondition(counts, () => 0);
    counts[condition] += 1;
    const values = Object.values(counts);
    assert.ok(Math.max(...values) - Math.min(...values) <= 1);
  }

  assert.deepEqual(counts, { educator: 3, coworker: 3, future_self: 3 });
});
