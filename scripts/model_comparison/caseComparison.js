const {
  predictionOf,
  toMap
} = require("./input");

function unique(values = []) {
  return [...new Set(values)];
}

function intersect(left = [], right = []) {
  const rightSet = new Set(right);
  return unique(left).filter(value => rightSet.has(value));
}

function compareCase(caseId, itemA, itemB) {
  const predictionA = predictionOf(itemA);
  const predictionB = predictionOf(itemB);
  const idsA = predictionA.candidate_scenario_ids || [];
  const idsB = predictionB.candidate_scenario_ids || [];

  return {
    case_id: caseId,
    detail_agreement:
      predictionA.detail_process && predictionB.detail_process
        ? predictionA.detail_process &&
          predictionA.detail_process === predictionB.detail_process
        : null,
    top1_scenario_agreement:
      idsA[0] !== undefined && idsB[0] !== undefined
        ? idsA[0] === idsB[0]
        : null,
    top3_scenario_overlap_evaluable: idsA.length > 0 && idsB.length > 0,
    top3_scenario_overlap_ids: intersect(idsA.slice(0, 3), idsB.slice(0, 3))
  };
}

function buildCaseComparisons(casesA, casesB) {
  const mapA = toMap(casesA);
  const mapB = toMap(casesB);

  // case_id 정렬은 paired comparison의 표본 순서를 고정해 reproducibility를 지킨다.
  const commonIds = [...mapA.keys()]
    .filter(caseId => mapB.has(caseId))
    .sort();

  return commonIds.map(caseId =>
    compareCase(caseId, mapA.get(caseId), mapB.get(caseId))
  );
}

module.exports = {
  buildCaseComparisons,
  intersect
};
