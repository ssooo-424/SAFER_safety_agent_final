const CONDITIONS = Object.freeze(['educator', 'coworker', 'future_self']);

function assertCondition(condition) {
  if (!CONDITIONS.includes(condition)) {
    throw new Error(`unsupported condition: ${condition}`);
  }
}

function chooseBalancedCondition(counts = {}, random = Math.random) {
  const normalizedCounts = CONDITIONS.map((condition) => ({
    condition,
    count: Number.isFinite(counts[condition]) ? counts[condition] : 0,
  }));
  const minimum = Math.min(...normalizedCounts.map(({ count }) => count));
  // 최소 배정 수 조건만 후보로 삼아 조건별 누적 배정을 균형 있게 유지한다.
  const candidates = normalizedCounts
    .filter(({ count }) => count === minimum)
    .map(({ condition }) => condition);
  const randomIndex = Math.floor(random() * candidates.length);

  return candidates[Math.min(Math.max(randomIndex, 0), candidates.length - 1)];
}

module.exports = {
  CONDITIONS,
  assertCondition,
  chooseBalancedCondition,
};
