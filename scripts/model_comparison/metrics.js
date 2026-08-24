const { intersect } = require("./caseComparison");
const { predictionOf } = require("./input");

function rate(hit, total) {
  return total > 0 ? Number((hit / total).toFixed(4)) : null;
}

function evaluateAgainstGold({ cases, goldMap }) {
  const metrics = {
    detail_evaluable: 0,
    detail_hits: 0,
    risk_evaluable: 0,
    top1_risk_hits: 0,
    top3_risk_hits: 0,
    scenario_evaluable: 0,
    top1_scenario_hits: 0,
    top3_scenario_hits: 0
  };

  for (const item of cases) {
    const gold = goldMap.get(item.case_id);
    if (!gold) {
      continue;
    }

    const prediction = predictionOf(item);
    const expectedDetail = gold.human_expected_detail_process;

    if (expectedDetail) {
      metrics.detail_evaluable++;
      if (prediction.detail_process === expectedDetail) {
        metrics.detail_hits++;
      }
    }

    const expectedRisks = gold.human_expected_risk_types || [];
    const predictedRisks = prediction.candidate_risk_types || [];

    if (expectedRisks.length > 0) {
      metrics.risk_evaluable++;
      if (predictedRisks[0] && expectedRisks.includes(predictedRisks[0])) {
        metrics.top1_risk_hits++;
      }
      if (intersect(expectedRisks, predictedRisks.slice(0, 3)).length > 0) {
        metrics.top3_risk_hits++;
      }
    }

    const acceptableIds = gold.acceptable_scenario_ids || [];
    const predictedIds = prediction.candidate_scenario_ids || [];

    if (acceptableIds.length > 0) {
      metrics.scenario_evaluable++;
      if (
        predictedIds[0] !== undefined &&
        acceptableIds.includes(predictedIds[0])
      ) {
        metrics.top1_scenario_hits++;
      }
      if (intersect(acceptableIds, predictedIds.slice(0, 3)).length > 0) {
        metrics.top3_scenario_hits++;
      }
    }
  }

  return {
    ...metrics,
    detail_accuracy: rate(metrics.detail_hits, metrics.detail_evaluable),
    top1_risk_accuracy: rate(metrics.top1_risk_hits, metrics.risk_evaluable),
    top3_risk_accuracy: rate(metrics.top3_risk_hits, metrics.risk_evaluable),
    top1_scenario_accuracy: rate(
      metrics.top1_scenario_hits,
      metrics.scenario_evaluable
    ),
    top3_scenario_accuracy: rate(
      metrics.top3_scenario_hits,
      metrics.scenario_evaluable
    )
  };
}

function agreementRate(comparisons, field) {
  const evaluable = comparisons.filter(
    item => typeof item[field] === "boolean"
  );
  return evaluable.length > 0
    ? Number(
        (
          evaluable.filter(item => item[field] === true).length /
          evaluable.length
        ).toFixed(4)
      )
    : null;
}

function buildAgreementMetrics(comparisons) {
  return {
    detail_evaluable_cases: comparisons.filter(
      item => typeof item.detail_agreement === "boolean"
    ).length,
    detail_agreement_rate: agreementRate(comparisons, "detail_agreement"),
    top1_scenario_evaluable_cases: comparisons.filter(
      item => typeof item.top1_scenario_agreement === "boolean"
    ).length,
    top1_scenario_agreement_rate: agreementRate(
      comparisons,
      "top1_scenario_agreement"
    ),
    top3_overlap_evaluable_cases: comparisons.filter(
      item => item.top3_scenario_overlap_evaluable
    ).length,
    cases_with_any_top3_overlap: comparisons.filter(
      item =>
        item.top3_scenario_overlap_evaluable &&
        item.top3_scenario_overlap_ids.length > 0
    ).length
  };
}

module.exports = {
  buildAgreementMetrics,
  evaluateAgainstGold
};
