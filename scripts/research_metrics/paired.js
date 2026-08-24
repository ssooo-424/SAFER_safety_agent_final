const { round } = require("./bootstrap");


function combination(n, k) {
  const reduced = Math.min(k, n - k);
  let value = 1;
  for (let index = 1; index <= reduced; index++) {
    value = value * (n - reduced + index) / index;
  }
  return value;
}


function exactMcNemar(leftCases, rightCases, field) {
  const rightMap = new Map(
    rightCases.map(item => [item.case_id, item])
  );
  let leftOnly = 0;
  let rightOnly = 0;
  // paired analysis는 같은 case_id를 비교해 사례별 난이도 차이를 통제한다.
  for (const left of leftCases) {
    const right = rightMap.get(left.case_id);
    if (
      !right ||
      typeof left[field] !== "boolean" ||
      typeof right[field] !== "boolean"
    ) {
      continue;
    }
    if (left[field] && !right[field]) {
      leftOnly++;
    } else if (!left[field] && right[field]) {
      rightOnly++;
    }
  }
  const discordant = leftOnly + rightOnly;
  if (discordant === 0) {
    return {
      left_only_hits: 0,
      right_only_hits: 0,
      discordant_pairs: 0,
      exact_two_sided_p: 1
    };
  }
  const tail = Math.min(leftOnly, rightOnly);
  let probability = 0;
  for (let index = 0; index <= tail; index++) {
    probability += combination(discordant, index) *
      Math.pow(0.5, discordant);
  }
  return {
    left_only_hits: leftOnly,
    right_only_hits: rightOnly,
    discordant_pairs: discordant,
    exact_two_sided_p: round(Math.min(1, probability * 2))
  };
}


function buildPairwiseComparisons(evaluations) {
  const pairwise = [];
  for (let leftIndex = 0; leftIndex < evaluations.length; leftIndex++) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < evaluations.length;
      rightIndex++
    ) {
      const left = evaluations[leftIndex];
      const right = evaluations[rightIndex];
      pairwise.push({
        model_a: left.model,
        model_b: right.model,
        hit_at_3_mcnemar: exactMcNemar(
          left.cases,
          right.cases,
          "hit_at_3"
        ),
        top1_scenario_mcnemar: exactMcNemar(
          left.cases,
          right.cases,
          "top1_scenario_hit"
        )
      });
    }
  }
  return pairwise;
}


module.exports = { buildPairwiseComparisons };
