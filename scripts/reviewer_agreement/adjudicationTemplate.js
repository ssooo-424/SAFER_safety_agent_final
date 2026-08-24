const { ratingMap } = require("./inputValidation");

function buildAdjudicationCase(caseId, itemA, itemB) {
  const ratingsA = ratingMap(itemA);
  const ratingsB = ratingMap(itemB);
  const scenarioIds = [...new Set([
    ...ratingsA.keys(),
    ...ratingsB.keys(),
    ...(itemA.acceptable_scenario_ids || []).map(String),
    ...(itemB.acceptable_scenario_ids || []).map(String)
  ])];
  const detailAgrees =
    itemA.expected_detail_process &&
    itemA.expected_detail_process === itemB.expected_detail_process;
  const riskAgrees =
    itemA.expected_primary_risk &&
    itemA.expected_primary_risk === itemB.expected_primary_risk;
  const bestAgrees =
    itemA.best_scenario_id !== null &&
    String(itemA.best_scenario_id) === String(itemB.best_scenario_id);
  return {
    case_id: caseId,
    scenario_match_evaluable:
      itemA.scenario_match_evaluable !== false &&
      itemB.scenario_match_evaluable !== false,
    evaluability_rule:
      itemA.evaluability_rule || itemB.evaluability_rule || "unknown",
    reviewer_a: {
      expected_detail_process: itemA.expected_detail_process,
      expected_primary_risk: itemA.expected_primary_risk,
      no_suitable_candidate: itemA.no_suitable_candidate,
      best_scenario_id: itemA.best_scenario_id,
      acceptable_scenario_ids: itemA.acceptable_scenario_ids || []
    },
    reviewer_b: {
      expected_detail_process: itemB.expected_detail_process,
      expected_primary_risk: itemB.expected_primary_risk,
      no_suitable_candidate: itemB.no_suitable_candidate,
      best_scenario_id: itemB.best_scenario_id,
      acceptable_scenario_ids: itemB.acceptable_scenario_ids || []
    },
    final_expected_detail_process:
      detailAgrees ? itemA.expected_detail_process : null,
    final_expected_primary_risk:
      riskAgrees ? itemA.expected_primary_risk : null,
    final_no_suitable_candidate:
      itemA.no_suitable_candidate === itemB.no_suitable_candidate
        ? itemA.no_suitable_candidate
        : null,
    final_best_scenario_id: bestAgrees ? itemA.best_scenario_id : null,
    final_acceptable_scenario_ids: [],
    scenario_relevance: scenarioIds.map(scenarioId => {
      const ratingA = ratingsA.get(scenarioId) || {};
      const ratingB = ratingsB.get(scenarioId) || {};
      const scoresAgree =
        Number.isInteger(ratingA.relevance_score) &&
        ratingA.relevance_score === ratingB.relevance_score;
      return {
        scenario_id: Number.isNaN(Number(scenarioId))
          ? scenarioId
          : Number(scenarioId),
        reviewer_a_score: ratingA.relevance_score ?? null,
        reviewer_b_score: ratingB.relevance_score ?? null,
        final_relevance_score: scoresAgree ? ratingA.relevance_score : null
      };
    }),
    adjudication_note: ""
  };
}

function buildAdjudicationTemplate(commonCaseIds, mapA, mapB) {
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    status: "draft",
    instructions: [
      "두 평가자의 선택이 다른 항목을 원문 작업상황과 후보 시나리오를 다시 보고 합의하세요.",
      "final_ 필드를 모두 확정하고 status를 confirmed로 변경하세요.",
      "적합도는 1=무관, 2=약함, 3=가능, 4=적합, 5=매우 적합입니다.",
      "final_acceptable_scenario_ids에는 4점 이상으로 합의한 후보를 넣는 것을 기본 원칙으로 합니다."
    ],
    cases: commonCaseIds.map(caseId => buildAdjudicationCase(
      caseId, mapA.get(caseId), mapB.get(caseId)
    ))
  };
}

module.exports = { buildAdjudicationTemplate };
