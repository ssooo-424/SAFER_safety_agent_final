const {
  parseArguments,
  readGold,
  readResult
} = require("./research_metrics/input");
const { evaluateModel } = require("./research_metrics/retrieval");
const { buildPairwiseComparisons } = require("./research_metrics/paired");
const { buildReport, writeReport } = require("./research_metrics/report");


function main() {
  const options = parseArguments(process.argv);
  const gold = readGold(options.goldPath, options.allowDraft);
  const goldMap = new Map(
    (gold.cases || gold.labels || [])
      .filter(item => item.scenario_match_evaluable !== false)
      .map(item => [item.case_id, item])
  );
  const evaluations = options.resultPaths.map(filePath =>
    evaluateModel(readResult(filePath), goldMap)
  );
  const pairwise = buildPairwiseComparisons(evaluations);
  const output = buildReport({
    gold,
    goldPath: options.goldPath,
    evaluations,
    pairwise
  });
  const outputPath = writeReport(options.outputPath, output);

  console.log(JSON.stringify({
    outputPath,
    models: evaluations.map(item => ({
      model: item.model,
      coverage: item.coverage,
      hit_at_3: item.hit_at_3,
      mrr_at_3: item.mrr_at_3,
      ndcg_at_3: item.ndcg_at_3
    })),
    pairwise_comparisons: pairwise
  }, null, 2));
}


try {
  main();
} catch (error) {
  console.error(`연구 지표 계산 실패: ${error.message}`);
  process.exitCode = 1;
}
