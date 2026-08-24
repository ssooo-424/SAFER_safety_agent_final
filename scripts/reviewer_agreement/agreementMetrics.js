function round(value) {
  return value === null || Number.isNaN(value) ? null : Number(value.toFixed(4));
}

function categoricalAgreement(pairs) {
  if (pairs.length === 0) {
    return { n: 0, percent_agreement: null, cohen_kappa: null };
  }
  const categories = [...new Set(pairs.flat())];
  const observed = pairs.filter(([left, right]) => left === right).length /
    pairs.length;
  let expected = 0;
  // Cohen kappa는 reviewer별 주변분포의 곱으로 chance agreement를 보정해야 합니다.
  for (const category of categories) {
    const leftRate = pairs.filter(([left]) => left === category).length /
      pairs.length;
    const rightRate = pairs.filter(([, right]) => right === category).length /
      pairs.length;
    expected += leftRate * rightRate;
  }
  const kappa = expected === 1
    ? null
    : (observed - expected) / (1 - expected);
  return {
    n: pairs.length,
    percent_agreement: round(observed),
    chance_expected_agreement: round(expected),
    cohen_kappa: round(kappa)
  };
}

function mean(values) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function percentile(values, probability) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] +
    (sorted[upper] - sorted[lower]) * (position - lower);
}

function seededRandom(seed = 20260818) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function bootstrapAgreement(groups, calculator, fields, iterations = 2000) {
  if (groups.length < 2) return null;
  const random = seededRandom();
  const distributions = Object.fromEntries(fields.map(field => [field, []]));
  // 동일 case의 후보들은 독립 표본이 아니므로 case-cluster 단위로 resampling합니다.
  for (let iteration = 0; iteration < iterations; iteration++) {
    const sampledPairs = [];
    for (let index = 0; index < groups.length; index++) {
      const sampledGroup = groups[Math.floor(random() * groups.length)];
      sampledPairs.push(...sampledGroup);
    }
    const calculated = calculator(sampledPairs);
    for (const field of fields) {
      if (typeof calculated[field] === "number") {
        distributions[field].push(calculated[field]);
      }
    }
  }
  return {
    method: "case-cluster bootstrap percentile interval",
    iterations,
    intervals: Object.fromEntries(fields.map(field => [field, {
      lower: round(percentile(distributions[field], 0.025)),
      upper: round(percentile(distributions[field], 0.975)),
      valid_iterations: distributions[field].length
    }]))
  };
}

function jaccard(leftValues, rightValues) {
  const left = new Set((leftValues || []).map(String));
  const right = new Set((rightValues || []).map(String));
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 1;
  return [...left].filter(value => right.has(value)).length / union.size;
}

function projectCriterion(metric) {
  const agreement = metric.percent_agreement ?? metric.percent_exact_agreement;
  const kappa = metric.cohen_kappa ?? metric.weighted_kappa_quadratic;
  return {
    rule:
      "사전 정의한 프로젝트 기준: 단순 일치율 >= 0.80 및 kappa >= 0.60; 목표 kappa >= 0.75",
    minimum_pass:
      agreement !== null && kappa !== null && agreement >= 0.8 && kappa >= 0.6,
    target_pass:
      agreement !== null && kappa !== null && agreement >= 0.8 && kappa >= 0.75
  };
}

module.exports = {
  bootstrapAgreement, categoricalAgreement, jaccard, mean, projectCriterion, round
};
