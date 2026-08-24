const {
  parseCliArguments,
  readJson,
  toMap
} = require("./model_comparison/input");
const {
  buildCaseComparisons
} = require("./model_comparison/caseComparison");
const {
  buildAgreementMetrics,
  evaluateAgainstGold
} = require("./model_comparison/metrics");
const {
  buildReport,
  printSummary,
  writeJson
} = require("./model_comparison/report");

function main() {
  const {
    modelAPath,
    modelBPath,
    goldPath,
    outputPath
  } = parseCliArguments(process.argv);
  const modelA = readJson(modelAPath);
  const modelB = readJson(modelBPath);
  const comparisons = buildCaseComparisons(
    modelA.cases || [],
    modelB.cases || []
  );
  const output = buildReport({
    modelA,
    modelB,
    goldPath,
    comparisons,
    agreement: buildAgreementMetrics(comparisons)
  });

  if (goldPath) {
    const gold = readJson(goldPath);
    const goldMap = toMap(gold.labels || []);

    // 같은 goldMap을 써야 paired comparison의 denominator가 재현된다.
    output.gold_status = gold.status || "unknown";
    output.model_a_gold_metrics = evaluateAgainstGold({
      cases: modelA.cases || [],
      goldMap
    });
    output.model_b_gold_metrics = evaluateAgainstGold({
      cases: modelB.cases || [],
      goldMap
    });
  }

  const savedPath = writeJson(outputPath, output);
  printSummary(savedPath, output);
}

try {
  main();
} catch (error) {
  console.error(`비교 실패: ${error.message}`);
  process.exitCode = 1;
}
