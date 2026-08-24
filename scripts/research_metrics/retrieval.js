const {
  bootstrapMeanInterval,
  mean,
  round
} = require("./bootstrap");


function unique(values) {
  return [...new Set(values)];
}


function expectedDetail(goldCase) {
  return goldCase.final_expected_detail_process ||
    goldCase.human_expected_detail_process ||
    null;
}


function expectedRisks(goldCase) {
  if (goldCase.final_expected_primary_risk) {
    return [goldCase.final_expected_primary_risk];
  }
  return goldCase.human_expected_risk_types || [];
}


function acceptableIds(goldCase) {
  return (
    goldCase.final_acceptable_scenario_ids ||
    goldCase.acceptable_scenario_ids ||
    []
  ).map(String);
}


function expectedNoSuitable(goldCase) {
  return typeof goldCase.final_no_suitable_candidate === "boolean"
    ? goldCase.final_no_suitable_candidate
    : null;
}


function relevanceMap(goldCase) {
  return new Map(
    (goldCase.scenario_relevance || [])
      .filter(item => Number.isInteger(item.final_relevance_score))
      .map(item => [
        String(item.scenario_id),
        item.final_relevance_score
      ])
  );
}


function dcg(scores) {
  return scores.reduce(
    (sum, score, index) =>
      sum +
      (Math.pow(2, score) - 1) /
        Math.log2(index + 2),
    0
  );
}


function evaluateCase(item, gold) {
  const prediction = item.prediction || {};
  const predictedIds = (
    prediction.candidate_scenario_ids || []
  ).slice(0, 3).map(String);
  const predictedRisks = (
    prediction.candidate_risk_types || []
  ).slice(0, 3);
  const detail = expectedDetail(gold);
  const risks = expectedRisks(gold);
  const acceptable = acceptableIds(gold);
  const noSuitable = expectedNoSuitable(gold);
  const acceptableSet = new Set(acceptable);
  const relevance = relevanceMap(gold);
  const retrievedAcceptable = predictedIds.filter(id =>
    acceptableSet.has(id)
  );
  const firstRelevantIndex = predictedIds.findIndex(id =>
    acceptableSet.has(id)
  );
  const retrievedScores = predictedIds.map(id => relevance.get(id) || 0);
  const idealScores = [...relevance.values()]
    .sort((left, right) => right - left)
    .slice(0, 3);
  const idealDcg = dcg(idealScores);

  return {
    case_id: item.case_id,
    prediction_coverage: predictedIds.length > 0,
    no_suitable_evaluable: noSuitable === true,
    correct_abstention:
      noSuitable === true
        ? predictedIds.length === 0
        : null,
    detail_evaluable: Boolean(detail),
    detail_hit: detail
      ? prediction.detail_process === detail
      : null,
    risk_evaluable: risks.length > 0,
    top1_risk_hit:
      risks.length > 0 && predictedRisks.length > 0
        ? risks.includes(predictedRisks[0])
        : null,
    top3_risk_hit:
      risks.length > 0 && predictedRisks.length > 0
        ? risks.some(risk => predictedRisks.includes(risk))
        : null,
    scenario_evaluable: acceptable.length > 0,
    top1_scenario_hit:
      acceptable.length > 0 && predictedIds.length > 0
        ? acceptableSet.has(predictedIds[0])
        : null,
    hit_at_3:
      acceptable.length > 0 && predictedIds.length > 0
        ? retrievedAcceptable.length > 0
        : null,
    precision_at_3:
      acceptable.length > 0 && predictedIds.length > 0
        ? retrievedAcceptable.length / predictedIds.length
        : null,
    recall_at_3:
      acceptable.length > 0 && predictedIds.length > 0
        ? unique(retrievedAcceptable).length /
          unique(acceptable).length
        : null,
    reciprocal_rank_at_3:
      acceptable.length > 0 && predictedIds.length > 0
        ? firstRelevantIndex >= 0
          ? 1 / (firstRelevantIndex + 1)
          : 0
        : null,
    ndcg_at_3:
      idealDcg > 0
        ? dcg(retrievedScores) / idealDcg
        : null,
    predicted_scenario_ids: predictedIds,
    acceptable_scenario_ids: acceptable
  };
}


function booleanMetric(caseMetrics, field) {
  const rows = caseMetrics.filter(item =>
    typeof item[field] === "boolean"
  );
  return {
    evaluable: rows.length,
    hits: rows.filter(item => item[field]).length,
    rate: round(
      rows.length > 0
        ? rows.filter(item => item[field]).length / rows.length
        : null
    ),
    bootstrap_95_ci: bootstrapMeanInterval(
      rows.map(item => item[field] ? 1 : 0)
    )
  };
}


function numericMetric(caseMetrics, field) {
  const values = caseMetrics
    .map(item => item[field])
    .filter(value => typeof value === "number");
  return {
    evaluable: values.length,
    mean: round(mean(values)),
    bootstrap_95_ci: bootstrapMeanInterval(values)
  };
}


function evaluateModel(result, goldMap) {
  const caseMetrics = [];
  for (const item of result.cases || []) {
    const gold = goldMap.get(item.case_id);
    if (gold) {
      caseMetrics.push(evaluateCase(item, gold));
    }
  }
  return {
    model: result.model || "unknown_model",
    case_count: caseMetrics.length,
    coverage: booleanMetric(caseMetrics, "prediction_coverage"),
    correct_abstention_on_no_match: booleanMetric(caseMetrics, "correct_abstention"),
    detail_accuracy: booleanMetric(caseMetrics, "detail_hit"),
    top1_risk_accuracy: booleanMetric(caseMetrics, "top1_risk_hit"),
    top3_risk_accuracy: booleanMetric(caseMetrics, "top3_risk_hit"),
    top1_scenario_accuracy: booleanMetric(caseMetrics, "top1_scenario_hit"),
    hit_at_3: booleanMetric(caseMetrics, "hit_at_3"),
    precision_at_3: numericMetric(caseMetrics, "precision_at_3"),
    recall_at_3: numericMetric(caseMetrics, "recall_at_3"),
    mrr_at_3: numericMetric(caseMetrics, "reciprocal_rank_at_3"),
    ndcg_at_3: numericMetric(caseMetrics, "ndcg_at_3"),
    cases: caseMetrics
  };
}


module.exports = { evaluateModel };
