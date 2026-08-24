function round(value) {
  return value === null || Number.isNaN(value)
    ? null
    : Number(value.toFixed(4));
}


function mean(values) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}


function percentile(values, probability) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] +
    (sorted[upper] - sorted[lower]) *
      (position - lower);
}


function bootstrapMeanInterval(values, iterations = 2000) {
  if (values.length < 2) {
    return null;
  }
  // fixed seed로 같은 입력의 bootstrap interval을 재현한다.
  let seed = 20260818;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const estimates = [];
  // case bootstrap은 사례 단위를 보존해 사례 간 변동성을 추정한다.
  for (let iteration = 0; iteration < iterations; iteration++) {
    let sum = 0;
    for (let index = 0; index < values.length; index++) {
      sum += values[Math.floor(random() * values.length)];
    }
    estimates.push(sum / values.length);
  }
  return {
    method: "case bootstrap percentile interval",
    iterations,
    lower: round(percentile(estimates, 0.025)),
    upper: round(percentile(estimates, 0.975))
  };
}


module.exports = {
  bootstrapMeanInterval,
  mean,
  round
};
