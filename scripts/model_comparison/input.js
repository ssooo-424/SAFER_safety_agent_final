const fs = require("fs");
const path = require("path");

const USAGE = "사용법: node scripts/compareScenarioModelResults.js <modelA.json> <modelB.json> [--gold gold.json] [--output comparison.json]";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function predictionOf(item = {}) {
  return item.prediction || {};
}

function toMap(items = []) {
  return new Map(items.map(item => [item.case_id, item]));
}

function getOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length
    ? argv[index + 1]
    : fallback;
}

function parseCliArguments(argv) {
  const positional = argv
    .slice(2)
    .filter(value => !value.startsWith("--"));

  if (positional.length < 2) {
    throw new Error(USAGE);
  }

  return {
    modelAPath: positional[0],
    modelBPath: positional[1],
    goldPath: getOption(argv, "--gold", ""),
    outputPath: getOption(
      argv,
      "--output",
      path.join("results", "scenario_matching", "model_comparison.json")
    )
  };
}

module.exports = {
  parseCliArguments,
  predictionOf,
  readJson,
  toMap
};
