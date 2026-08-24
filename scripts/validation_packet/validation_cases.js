const {
  cleanText,
  classifyScenarioMatchEvaluability,
  deidentifyCase
} = require("./evaluability");
const { compactScenario, unique } = require("./scenario_catalog");

function validatePrediction(context) {
  const {
    caseId,
    eligibleIdSet,
    majorDetails,
    modelResult,
    prediction,
    scenarioById
  } = context;
  const scenarioIds = (prediction.candidate_scenario_ids || []).slice(0, 3);
  const predictedDetail = cleanText(prediction.detail_process);
  const invalidIds = scenarioIds.filter(
    id => !eligibleIdSet.has(String(id))
  );
  if (invalidIds.length > 0) {
    throw new Error(
      `${modelResult.model}의 ${caseId}에 대공정 후보 밖의 ID가 있습니다: ${invalidIds.join(", ")}`
    );
  }
  if (
    scenarioIds.length > 0 &&
    !Object.keys(majorDetails).includes(predictedDetail)
  ) {
    throw new Error(
      `${modelResult.model}의 ${caseId} 세부공정 '${predictedDetail}'이 허용 목록에 없습니다.`
    );
  }
  const detailMismatchIds = scenarioIds.filter(id => {
    const candidate = scenarioById.get(String(id));
    return candidate && candidate.detail_process !== predictedDetail;
  });
  if (detailMismatchIds.length > 0) {
    throw new Error(
      `${modelResult.model}의 ${caseId} 후보가 선택 세부공정과 다릅니다: ${detailMismatchIds.join(", ")}`
    );
  }
  const predictedRisks = prediction.candidate_risk_types || [];
  const riskMismatchIds = scenarioIds.filter((id, candidateIndex) => {
    const candidate = scenarioById.get(String(id));
    return candidate &&
      predictedRisks[candidateIndex] !== candidate.primary_risk_type;
  });
  if (riskMismatchIds.length > 0) {
    throw new Error(
      `${modelResult.model}의 ${caseId} 후보 ID와 사고유형이 다릅니다: ${riskMismatchIds.join(", ")}`
    );
  }
  return scenarioIds;
}

function buildBaseCase(testCase, context) {
  const { modelResults, riskTypes, scenarioById, scenarioPool } = context;
  const caseId = testCase.case_id;
  const input = deidentifyCase(testCase);
  const majorDetails = scenarioPool[input.major_process] || {};
  const evaluability = classifyScenarioMatchEvaluability(
    testCase,
    Object.keys(majorDetails)
  );
  const eligible = Object.values(majorDetails).flat().map(compactScenario);
  const eligibleIdSet = new Set(
    eligible.map(item => String(item.scenario_id))
  );
  const rankingRecords = modelResults.map((modelResult, index) => {
    const modelCase = modelResult.cases.get(caseId) || {};
    const prediction = modelCase.prediction || {};
    const scenarioIds = validatePrediction({
      caseId,
      eligibleIdSet,
      majorDetails,
      modelResult,
      prediction,
      scenarioById
    });
    return {
      system_code: `SYSTEM_${String.fromCharCode(65 + index)}`,
      model: modelResult.model,
      scenario_ids: scenarioIds
    };
  });
  const pooledIds = unique(
    rankingRecords.flatMap(item => item.scenario_ids)
  );
  const pooledCandidates = pooledIds
    .map(id => scenarioById.get(String(id)))
    .filter(Boolean);
  return {
    case_id: caseId,
    test_tag: testCase.test_tag || "",
    input,
    ...evaluability,
    allowed_detail_processes: Object.keys(majorDetails),
    allowed_risk_types: riskTypes,
    eligible_candidates: eligible,
    pooled_candidates: pooledCandidates,
    source_rankings: rankingRecords
  };
}

function buildBaseCases(testCases, context) {
  return testCases.map(testCase => buildBaseCase(testCase, context));
}

module.exports = { buildBaseCases };
