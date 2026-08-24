const fs = require("fs");
const path = require("path");

const { parseCliOptions } = require("./scenario_matching/cli");
const { evaluateScenarioMatching } = require("./scenario_matching/evaluation");
const {
  buildGoldTemplate,
  buildResults,
  readJson,
  writeReports
} = require("./scenario_matching/reportOutput");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCENARIO_PATH = path.join(PROJECT_ROOT, "reference_data", "scenarios.json");

function main() {
  const options = parseCliOptions(process.argv, PROJECT_ROOT);
  if (!fs.existsSync(options.inputPath)) {
    throw new Error(`테스트 입력 파일이 없습니다: ${options.inputPath}`);
  }

  const testCases = readJson(options.inputPath);
  const scenarioPool = readJson(SCENARIO_PATH);
  if (!Array.isArray(testCases)) {
    throw new Error("테스트 입력은 JSON 배열이어야 합니다.");
  }

  const evaluation = evaluateScenarioMatching({
    testCases,
    scenarioPool,
    modelName: options.modelName
  });
  const results = buildResults({
    modelName: options.modelName,
    inputPath: options.inputPath,
    scenarioPath: SCENARIO_PATH,
    evaluation
  });
  const report = writeReports({
    outputDir: options.outputDir,
    modelName: options.modelName,
    results,
    goldTemplate: buildGoldTemplate(evaluation.cases),
    overwriteGold: options.overwriteGold
  });

  console.log(JSON.stringify({
    ...report,
    requestedModelName: options.requestedModelName,
    normalizedModelName: options.modelName,
    summary: results.summary
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`평가 실패: ${error.message}`);
  process.exitCode = 1;
}
