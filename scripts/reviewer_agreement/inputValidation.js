const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function getOption(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : undefined;
}

function parseCliOptions(argv) {
  const positional = argv.slice(2).filter((value, index, values) => {
    if (value.startsWith("--")) return false;
    return index === 0 || !values[index - 1].startsWith("--");
  });
  if (positional.length < 2) {
    throw new Error(
      "사용법: node scripts/analyzeScenarioReviewerAgreement.js <reviewerA.json> <reviewerB.json> [--output agreement.json] [--adjudication adjudication.json]"
    );
  }
  return {
    reviewAPath: positional[0],
    reviewBPath: positional[1],
    allowDraft: argv.includes("--allow-draft"),
    outputPath: getOption(argv, "--output"),
    adjudicationPath: getOption(argv, "--adjudication")
  };
}

function caseMap(review) {
  return new Map((review.cases || []).map(item => [item.case_id, item]));
}

function ratingMap(reviewCase = {}) {
  return new Map((reviewCase.candidate_ratings || []).map(item => [
    String(item.scenario_id), item
  ]));
}

function loadReviews(options) {
  const reviewA = readJson(options.reviewAPath);
  const reviewB = readJson(options.reviewBPath);
  if (!options.allowDraft && (
    reviewA.review_status !== "complete" ||
    reviewB.review_status !== "complete"
  )) {
    throw new Error(
      "두 검토 파일의 review_status가 complete여야 합니다. 중간 점검만 하려면 --allow-draft를 추가하세요."
    );
  }
  return { reviewA, reviewB, mapA: caseMap(reviewA), mapB: caseMap(reviewB) };
}

module.exports = { loadReviews, parseCliOptions, ratingMap };
