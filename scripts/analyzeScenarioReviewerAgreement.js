const path = require("path");

const { loadReviews, parseCliOptions } = require("./reviewer_agreement/inputValidation");
const { collectCaseComparisons } = require("./reviewer_agreement/caseComparison");
const {
  buildAgreementReport,
  writeResults
} = require("./reviewer_agreement/reportOutput");
const { buildAdjudicationTemplate } = require("./reviewer_agreement/adjudicationTemplate");

function main() {
  const options = parseCliOptions(process.argv);
  const { reviewA, reviewB, mapA, mapB } = loadReviews(options);
  const comparisons = collectCaseComparisons(mapA, mapB);
  const output = buildAgreementReport(reviewA, reviewB, comparisons);
  const adjudication = buildAdjudicationTemplate(
    comparisons.commonCaseIds,
    mapA,
    mapB
  );
  const paths = writeResults({
    output,
    adjudication,
    outputPath: options.outputPath || path.join(
      "results", "scenario_validation", "reviewer_agreement.json"
    ),
    adjudicationPath: options.adjudicationPath || path.join(
      "results", "scenario_validation", "adjudication_template.json"
    )
  });

  console.log(JSON.stringify({ ...paths, metrics: output.metrics }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`평가자 신뢰도 계산 실패: ${error.message}`);
  process.exitCode = 1;
}
