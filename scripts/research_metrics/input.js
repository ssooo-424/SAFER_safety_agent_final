const fs = require("fs");
const path = require("path");


function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(path.resolve(filePath), "utf8")
  );
}


function getOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1]
    ? argv[index + 1]
    : fallback;
}


function positionalArguments(argv) {
  const result = [];
  const args = argv.slice(2);
  const optionsWithValue = new Set([
    "--gold",
    "--output"
  ]);
  for (let index = 0; index < args.length; index++) {
    if (args[index].startsWith("--")) {
      if (optionsWithValue.has(args[index])) {
        index++;
      }
      continue;
    }
    result.push(args[index]);
  }
  return result;
}


function parseArguments(argv) {
  const goldPath = getOption(argv, "--gold", "");
  const resultPaths = positionalArguments(argv);
  if (!goldPath || resultPaths.length === 0) {
    throw new Error(
      "사용법: node scripts/evaluateScenarioResearchMetrics.js <modelA.json> [modelB.json] --gold adjudication.json [--output metrics.json]"
    );
  }
  return {
    goldPath,
    resultPaths,
    outputPath: getOption(
      argv,
      "--output",
      path.join("results", "scenario_validation", "research_metrics.json")
    ),
    allowDraft: argv.includes("--allow-draft")
  };
}


function readGold(filePath, allowDraft) {
  const gold = readJson(filePath);
  if (gold.status !== "confirmed" && !allowDraft) {
    throw new Error(
      "합의 정답 파일의 status가 confirmed가 아닙니다. 검토 중 확인만 하려면 --allow-draft를 추가하세요."
    );
  }
  return gold;
}


module.exports = {
  parseArguments,
  readGold,
  readResult: readJson
};
