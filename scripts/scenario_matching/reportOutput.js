const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function buildResults({ modelName, inputPath, scenarioPath, evaluation }) {
  return {
    schema_version: "1.0",
    model: modelName,
    input_file: inputPath,
    scenario_source: scenarioPath,
    evaluation_status: "provisional_until_human_gold_labels_are_completed",
    summary: evaluation.summary,
    cases: evaluation.cases
  };
}

function buildGoldTemplate(evaluatedCases) {
  return {
    schema_version: "1.0",
    instructions: [
      "suggested 값은 자동 추정이므로 그대로 정답으로 사용하지 마세요.",
      "human_expected_detail_process를 INDEX의 실제 세부공정명으로 입력하세요.",
      "human_expected_risk_types에는 허용 가능한 대표 사고유형을 배열로 입력하세요.",
      "acceptable_scenario_ids에는 정답으로 인정할 237개 시나리오 ID를 하나 이상 입력하세요.",
      "사람 검토가 끝난 뒤 status를 confirmed로 변경하세요."
    ],
    status: "draft",
    labels: evaluatedCases.map(item => ({
      case_id: item.case_id,
      test_tag: item.test_tag,
      major_process: item.input.major_process,
      consequence: item.input.consequence,
      suggested_detail_process: item.reference_suggestion.detail_process,
      suggested_risk_types: item.reference_suggestion.expected_risk_types,
      human_expected_detail_process: null,
      human_expected_risk_types: [],
      acceptable_scenario_ids: [],
      review_note: ""
    }))
  };
}

function writeReports({ outputDir, modelName, results, goldTemplate, overwriteGold }) {
  const resultPath = path.join(outputDir, `${modelName}_results.json`);
  const goldPath = path.join(outputDir, "gold_labels_template.json");
  writeJson(resultPath, results);

  // 검토자가 작성한 gold file은 명시적 overwrite 없이는 보존한다.
  const goldTemplateAction = !fs.existsSync(goldPath) || overwriteGold
    ? "written"
    : "preserved_existing_file";
  if (goldTemplateAction === "written") writeJson(goldPath, goldTemplate);
  return { resultPath, goldPath, goldTemplateAction };
}

module.exports = {
  buildGoldTemplate,
  buildResults,
  readJson,
  writeJson,
  writeReports
};
