const {
  buildCandidateResult,
  cleanText,
  resolveDetailProcess,
  selectCurrentCandidates
} = require("./candidateConstruction");
const { inferExpectedRiskTypes } = require("./riskInference");

function roundRate(numerator, denominator) {
  if (denominator === 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

function evaluateCase(testCase, scenarioPool, detailsByMajor, modelName) {
  const detailResolution = resolveDetailProcess({ testCase, detailsByMajor });
  const riskReference = inferExpectedRiskTypes(testCase);
  const major = cleanText(testCase.majorProcess);
  const pool = detailResolution.detail
    ? scenarioPool[major]?.[detailResolution.detail] || []
    : [];
  const candidateResults = selectCurrentCandidates(pool).map(buildCandidateResult);
  const candidateRisks = candidateResults.map(item => item.primary_risk_type);
  const top1RiskHit = riskReference.risks.length > 0 && candidateRisks.length > 0
    ? riskReference.risks.includes(candidateRisks[0])
    : null;
  const top3RiskHit = riskReference.risks.length > 0 && candidateRisks.length > 0
    ? riskReference.risks.some(risk => candidateRisks.includes(risk))
    : null;

  return {
    case_id: testCase.case_id,
    test_tag: testCase.test_tag,
    input: {
      major_process: major,
      provided_detail_process: testCase.detailProcess,
      position: testCase.position,
      job_types: testCase.jobType || [],
      consequence: testCase.consequence,
      triggers: testCase.triggers || []
    },
    reference_suggestion: {
      detail_process: detailResolution.detail || null,
      detail_source: detailResolution.source,
      detail_confidence: detailResolution.confidence,
      expected_risk_types: riskReference.risks,
      risk_source: riskReference.source,
      risk_confidence: riskReference.confidence,
      // 자동 reference는 human gold가 아니므로 provisional 상태를 유지한다.
      requires_human_review:
        detailResolution.confidence !== "confirmed" ||
        riskReference.confidence !== "confirmed"
    },
    prediction: {
      model: modelName,
      detail_process: detailResolution.detail || null,
      candidate_scenario_ids: candidateResults.map(item => item.scenario_id),
      candidate_risk_types: candidateRisks,
      candidates: candidateResults
    },
    provisional_evaluation: {
      process_resolved: Boolean(detailResolution.detail),
      candidate_count: candidateResults.length,
      top1_risk_hit: top1RiskHit,
      top3_risk_hit: top3RiskHit
    }
  };
}

function buildSummary(evaluatedCases) {
  const riskEvaluable = evaluatedCases.filter(item => item.provisional_evaluation.top3_risk_hit !== null);
  const processResolved = evaluatedCases.filter(item => item.provisional_evaluation.process_resolved);
  const riskReferenceResolved = evaluatedCases.filter(
    item => item.reference_suggestion.expected_risk_types.length > 0
  );
  const top1Hits = riskEvaluable.filter(item => item.provisional_evaluation.top1_risk_hit === true).length;
  const top3Hits = riskEvaluable.filter(item => item.provisional_evaluation.top3_risk_hit === true).length;

  return {
    total_cases: evaluatedCases.length,
    process_resolved_cases: processResolved.length,
    process_resolution_rate: roundRate(processResolved.length, evaluatedCases.length),
    risk_evaluable_cases: riskEvaluable.length,
    risk_reference_resolved_cases: riskReferenceResolved.length,
    provisional_top1_risk_hits: top1Hits,
    provisional_top1_risk_accuracy: roundRate(top1Hits, riskEvaluable.length),
    provisional_top3_risk_hits: top3Hits,
    provisional_top3_risk_accuracy: roundRate(top3Hits, riskEvaluable.length),
    unresolved_detail_case_ids: evaluatedCases
      .filter(item => !item.provisional_evaluation.process_resolved)
      .map(item => item.case_id),
    unresolved_reference_risk_case_ids: evaluatedCases
      .filter(item => item.reference_suggestion.expected_risk_types.length === 0)
      .map(item => item.case_id),
    not_risk_evaluable_case_ids: evaluatedCases
      .filter(item => item.provisional_evaluation.top3_risk_hit === null)
      .map(item => item.case_id)
  };
}

function evaluateScenarioMatching({ testCases, scenarioPool, modelName }) {
  const detailsByMajor = new Map(
    Object.entries(scenarioPool).map(([major, details]) => [major, Object.keys(details)])
  );
  const cases = testCases.map(testCase =>
    evaluateCase(testCase, scenarioPool, detailsByMajor, modelName)
  );
  return { cases, summary: buildSummary(cases) };
}

module.exports = { buildSummary, evaluateCase, evaluateScenarioMatching, roundRate };
