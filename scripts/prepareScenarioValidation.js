const path = require("path");

const {
  assertFilesExist,
  readJson,
  resolveOptions
} = require("./validation_packet/input");
const { buildHumanBundle, writePackets } = require(
  "./validation_packet/packet_output"
);
const {
  flattenScenarioPool,
  modelCaseMap,
  unique
} = require("./validation_packet/scenario_catalog");
const { buildBaseCases } = require(
  "./validation_packet/validation_cases"
);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULTS = {
  input: path.join(PROJECT_ROOT, "tests", "fixtures", "model_test_cases_30.json"),
  scenarios: path.join(PROJECT_ROOT, "reference_data", "scenarios.json"),
  baseline: path.join(
    PROJECT_ROOT,
    "results",
    "scenario_matching",
    "current_index_selector_results.json"
  ),
  outputDir: path.join(PROJECT_ROOT, "results", "scenario_validation"),
  publicBundle: path.join(
    PROJECT_ROOT,
    "public",
    "research",
    "scenario_validation_bundle.json"
  )
};

function main() {
  const {
    inputPath,
    scenarioPath,
    outputDir,
    publicBundlePath,
    resultPaths
  } = resolveOptions(process.argv, DEFAULTS);
  assertFilesExist([inputPath, scenarioPath, ...resultPaths]);

  const testCases = readJson(inputPath);
  const scenarioPool = readJson(scenarioPath);
  const scenarioCatalog = flattenScenarioPool(scenarioPool);
  const scenarioById = new Map(
    scenarioCatalog.map(item => [String(item.scenario_id), item])
  );
  const modelResults = resultPaths.map(filePath => {
    const result = readJson(filePath);
    return {
      file_path: filePath,
      model: result.model || path.basename(filePath, ".json"),
      cases: modelCaseMap(result)
    };
  });
  const riskTypes = unique(
    scenarioCatalog.map(item => item.primary_risk_type)
  ).sort();
  const baseCases = buildBaseCases(testCases, {
    modelResults,
    riskTypes,
    scenarioById,
    scenarioPool
  });
  const humanBundle = buildHumanBundle(baseCases, modelResults, riskTypes);
  const packetPaths = writePackets({
    baseCases,
    humanBundle,
    outputDir,
    publicBundlePath
  });

  console.log(JSON.stringify({
    inputPath,
    resultPaths,
    test_case_count: testCases.length,
    scenario_count: scenarioCatalog.length,
    pooled_candidate_count: humanBundle.cases.reduce(
      (total, item) => total + item.review_candidates.length,
      0
    ),
    ...packetPaths,
    publicBundlePath
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`검증 패킷 생성 실패: ${error.message}`);
  process.exitCode = 1;
}
