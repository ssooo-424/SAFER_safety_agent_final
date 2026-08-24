const { jaccard, round } = require("./agreementMetrics");
const { ratingMap } = require("./inputValidation");

function appendCaseRatings(itemA, itemB, collections) {
  const ratingsA = ratingMap(itemA);
  const ratingsB = ratingMap(itemB);
  const commonScenarioIds = [...ratingsA.keys()]
    .filter(scenarioId => ratingsB.has(scenarioId));
  const caseRatingPairs = [];
  const caseAcceptablePairs = [];
  for (const scenarioId of commonScenarioIds) {
    const ratingA = ratingsA.get(scenarioId);
    const ratingB = ratingsB.get(scenarioId);
    if (
      Number.isInteger(ratingA.relevance_score) &&
      Number.isInteger(ratingB.relevance_score)
    ) {
      const pair = [ratingA.relevance_score, ratingB.relevance_score];
      collections.ratingPairs.push(pair);
      caseRatingPairs.push(pair);
    }
    if (
      typeof ratingA.acceptable === "boolean" &&
      typeof ratingB.acceptable === "boolean"
    ) {
      const pair = [String(ratingA.acceptable), String(ratingB.acceptable)];
      collections.acceptablePairs.push(pair);
      caseAcceptablePairs.push(pair);
    }
  }
  if (caseRatingPairs.length > 0) collections.ratingPairGroups.push(caseRatingPairs);
  if (caseAcceptablePairs.length > 0) {
    collections.acceptablePairGroups.push(caseAcceptablePairs);
  }
}

function appendCaseLabels(itemA, itemB, collections) {
  if (itemA.expected_detail_process && itemB.expected_detail_process) {
    const pair = [itemA.expected_detail_process, itemB.expected_detail_process];
    collections.detailPairs.push(pair);
    collections.detailPairGroups.push([pair]);
  }
  if (itemA.expected_primary_risk && itemB.expected_primary_risk) {
    const pair = [itemA.expected_primary_risk, itemB.expected_primary_risk];
    collections.riskPairs.push(pair);
    collections.riskPairGroups.push([pair]);
  }
  if (itemA.best_scenario_id !== null && itemB.best_scenario_id !== null) {
    const pair = [String(itemA.best_scenario_id), String(itemB.best_scenario_id)];
    collections.bestScenarioPairs.push(pair);
    collections.bestScenarioPairGroups.push([pair]);
  }
}

function createCollections() {
  return {
    detailPairs: [], riskPairs: [], bestScenarioPairs: [], ratingPairs: [],
    acceptablePairs: [], detailPairGroups: [], riskPairGroups: [],
    bestScenarioPairGroups: [], ratingPairGroups: [], acceptablePairGroups: [],
    setJaccards: [], caseComparisons: []
  };
}

function excludedComparison(caseId, itemA, itemB) {
  return {
    case_id: caseId,
    scenario_match_evaluable: false,
    exclusion_reason:
      itemA.evaluability_rule || itemB.evaluability_rule ||
      "excluded_by_review_protocol",
    detail_agreement: null,
    risk_agreement: null,
    best_scenario_agreement: null,
    acceptable_set_jaccard: null
  };
}

function evaluableComparison(caseId, itemA, itemB, setAgreement) {
  return {
    case_id: caseId,
    scenario_match_evaluable: true,
    detail_agreement:
      itemA.expected_detail_process && itemB.expected_detail_process
        ? itemA.expected_detail_process === itemB.expected_detail_process
        : null,
    risk_agreement:
      itemA.expected_primary_risk && itemB.expected_primary_risk
        ? itemA.expected_primary_risk === itemB.expected_primary_risk
        : null,
    best_scenario_agreement:
      itemA.best_scenario_id !== null && itemB.best_scenario_id !== null
        ? String(itemA.best_scenario_id) === String(itemB.best_scenario_id)
        : null,
    acceptable_set_jaccard: round(setAgreement)
  };
}

function collectCaseComparisons(mapA, mapB) {
  const commonCaseIds = [...mapA.keys()]
    .filter(caseId => mapB.has(caseId))
    .sort();
  const collections = createCollections();
  for (const caseId of commonCaseIds) {
    const itemA = mapA.get(caseId);
    const itemB = mapB.get(caseId);
    const scenarioEvaluable =
      itemA.scenario_match_evaluable !== false &&
      itemB.scenario_match_evaluable !== false;
    // 한 reviewer라도 평가 불가로 판정한 case는 protocol상 모든 agreement metric에서 제외합니다.
    if (!scenarioEvaluable) {
      collections.caseComparisons.push(excludedComparison(caseId, itemA, itemB));
      continue;
    }
    appendCaseLabels(itemA, itemB, collections);
    appendCaseRatings(itemA, itemB, collections);
    const setAgreement = jaccard(
      itemA.acceptable_scenario_ids,
      itemB.acceptable_scenario_ids
    );
    collections.setJaccards.push(setAgreement);
    collections.caseComparisons.push(
      evaluableComparison(caseId, itemA, itemB, setAgreement)
    );
  }
  return { commonCaseIds, ...collections };
}

module.exports = { collectCaseComparisons };
