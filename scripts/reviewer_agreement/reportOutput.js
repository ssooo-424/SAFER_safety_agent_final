const fs = require("fs");
const path = require("path");

const {
  bootstrapAgreement,
  categoricalAgreement,
  mean,
  projectCriterion,
  round
} = require("./agreementMetrics");
const { weightedAgreement } = require("./weightedKappa");

function metricWithBootstrap(pairs, groups, fields, calculator) {
  const agreement = calculator(pairs);
  return {
    ...agreement,
    bootstrap_95_ci: bootstrapAgreement(groups, calculator, fields),
    project_criterion: projectCriterion(agreement)
  };
}

function buildAgreementReport(reviewA, reviewB, comparisons) {
  const cases = comparisons.caseComparisons;
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    reviewer_a: reviewA.reviewer_id || "reviewer_a",
    reviewer_b: reviewB.reviewer_id || "reviewer_b",
    common_case_count: comparisons.commonCaseIds.length,
    scenario_evaluable_case_count: cases.filter(
      item => item.scenario_match_evaluable
    ).length,
    excluded_case_ids: cases
      .filter(item => !item.scenario_match_evaluable)
      .map(item => item.case_id),
    interpretation_note:
      "kappa는 우연 일치를 보정합니다. 범주 분포가 한쪽에 몰리면 단순 일치율이 높아도 kappa가 낮거나 계산 불가할 수 있으므로 두 값을 함께 보고합니다.",
    metrics: {
      detail_process: metricWithBootstrap(
        comparisons.detailPairs,
        comparisons.detailPairGroups,
        ["percent_agreement", "cohen_kappa"],
        categoricalAgreement
      ),
      primary_risk: metricWithBootstrap(
        comparisons.riskPairs,
        comparisons.riskPairGroups,
        ["percent_agreement", "cohen_kappa"],
        categoricalAgreement
      ),
      best_scenario: metricWithBootstrap(
        comparisons.bestScenarioPairs,
        comparisons.bestScenarioPairGroups,
        ["percent_agreement", "cohen_kappa"],
        categoricalAgreement
      ),
      candidate_acceptability: metricWithBootstrap(
        comparisons.acceptablePairs,
        comparisons.acceptablePairGroups,
        ["percent_agreement", "cohen_kappa"],
        categoricalAgreement
      ),
      relevance_score_1_to_5: metricWithBootstrap(
        comparisons.ratingPairs,
        comparisons.ratingPairGroups,
        ["percent_exact_agreement", "weighted_kappa_quadratic"],
        weightedAgreement
      ),
      acceptable_scenario_set: {
        case_count: comparisons.setJaccards.length,
        mean_jaccard: round(mean(comparisons.setJaccards))
      }
    },
    cases
  };
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(value, null, 2), "utf8");
  return resolved;
}

function writeResults({ output, adjudication, outputPath, adjudicationPath }) {
  return {
    outputPath: writeJson(outputPath, output),
    adjudicationPath: writeJson(adjudicationPath, adjudication)
  };
}

module.exports = { buildAgreementReport, writeResults };
