const { round } = require("./agreementMetrics");

function weightedAgreement(pairs, minimum = 1, maximum = 5) {
  if (pairs.length === 0) {
    return { n: 0, percent_exact_agreement: null, weighted_kappa_quadratic: null };
  }
  const categories = [];
  for (let value = minimum; value <= maximum; value++) categories.push(value);
  const denominator = Math.pow(maximum - minimum, 2) || 1;
  // ordinal score의 큰 차이를 더 강하게 반영하기 위해 quadratic weight를 사용합니다.
  const weight = (left, right) =>
    1 - Math.pow(left - right, 2) / denominator;
  const observedWeighted = pairs.reduce(
    (sum, [left, right]) => sum + weight(left, right), 0
  ) / pairs.length;
  let expectedWeighted = 0;
  for (const leftCategory of categories) {
    const leftRate = pairs.filter(([left]) => left === leftCategory).length /
      pairs.length;
    for (const rightCategory of categories) {
      const rightRate = pairs.filter(([, right]) => right === rightCategory).length /
        pairs.length;
      expectedWeighted += leftRate * rightRate * weight(leftCategory, rightCategory);
    }
  }
  const kappa = expectedWeighted === 1
    ? null
    : (observedWeighted - expectedWeighted) / (1 - expectedWeighted);
  return {
    n: pairs.length,
    percent_exact_agreement: round(
      pairs.filter(([left, right]) => left === right).length / pairs.length
    ),
    mean_absolute_difference: round(
      pairs.reduce((sum, [left, right]) => sum + Math.abs(left - right), 0) /
        pairs.length
    ),
    observed_weighted_agreement: round(observedWeighted),
    weighted_kappa_quadratic: round(kappa)
  };
}

module.exports = { weightedAgreement };
