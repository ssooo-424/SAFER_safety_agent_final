const fs = require("fs");
const path = require("path");

function buildReport({ modelA, modelB, goldPath, comparisons, agreement }) {
  return {
    schema_version: "1.0",
    model_a: modelA.model || "model_a",
    model_b: modelB.model || "model_b",
    common_case_count: comparisons.length,
    agreement,
    gold_status: goldPath ? "provided" : "not_provided",
    model_a_gold_metrics: null,
    model_b_gold_metrics: null,
    cases: comparisons
  };
}

function writeJson(filePath, data) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2), "utf8");
  return resolved;
}

function printSummary(savedPath, output) {
  console.log(
    JSON.stringify(
      {
        savedPath,
        agreement: output.agreement,
        gold_status: output.gold_status,
        model_a_gold_metrics: output.model_a_gold_metrics,
        model_b_gold_metrics: output.model_b_gold_metrics
      },
      null,
      2
    )
  );
}

module.exports = {
  buildReport,
  printSummary,
  writeJson
};
