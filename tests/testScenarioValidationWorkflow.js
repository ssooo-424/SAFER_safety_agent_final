const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");


const projectRoot = path.resolve(__dirname, "..");
const bundle = JSON.parse(
  fs.readFileSync(
    path.join(
      projectRoot,
      "results",
      "scenario_validation",
      "human_review_bundle.json"
    ),
    "utf8"
  )
);
const temporaryRoot = path.resolve(os.tmpdir());
const temporaryDirectory = fs.mkdtempSync(
  path.join(temporaryRoot, "safer-validation-")
);


function writeJson(filePath, value) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2),
    "utf8"
  );
}


function buildReview(reviewerId, introduceDisagreement) {
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    reviewer_id: reviewerId,
    reviewer_expertise: "workflow test",
    review_status: "complete",
    completed_at: new Date().toISOString(),
    cases: bundle.cases.map((item, index) => {
      const candidates = item.review_candidates || [];
      const firstCandidate = candidates[0] || null;
      const detail =
        introduceDisagreement &&
        index === 1 &&
        item.allowed_detail_processes.length > 1
          ? item.allowed_detail_processes.at(-1)
          : item.allowed_detail_processes[0];
      const risk = firstCandidate
        ? firstCandidate.primary_risk_type
        : item.allowed_risk_types[0];
      return {
        case_id: item.case_id,
        expected_detail_process: detail,
        expected_primary_risk: risk,
        no_suitable_candidate: !firstCandidate,
        best_scenario_id: firstCandidate
          ? firstCandidate.scenario_id
          : null,
        acceptable_scenario_ids: firstCandidate
          ? [firstCandidate.scenario_id]
          : [],
        candidate_ratings: candidates.map((candidate, candidateIndex) => ({
          scenario_id: candidate.scenario_id,
          relevance_score:
            introduceDisagreement &&
            index === 0 &&
            candidateIndex === 0
              ? 4
              : candidateIndex === 0
                ? 5
                : 2,
          acceptable: candidateIndex === 0,
          note: ""
        })),
        reviewer_note: ""
      };
    })
  };
}


function run(script, args) {
  childProcess.execFileSync(
    process.execPath,
    [path.join(projectRoot, "scripts", script), ...args],
    {
      cwd: projectRoot,
      stdio: "pipe"
    }
  );
}


try {
  const reviewerAPath = path.join(temporaryDirectory, "reviewer_a.json");
  const reviewerBPath = path.join(temporaryDirectory, "reviewer_b.json");
  const agreementPath = path.join(temporaryDirectory, "agreement.json");
  const adjudicationPath = path.join(temporaryDirectory, "adjudication.json");
  const metricsPath = path.join(temporaryDirectory, "metrics.json");
  writeJson(reviewerAPath, buildReview("R1", false));
  writeJson(reviewerBPath, buildReview("R2", true));


  run("analyzeScenarioReviewerAgreement.js", [
    reviewerAPath,
    reviewerBPath,
    "--output",
    agreementPath,
    "--adjudication",
    adjudicationPath
  ]);
  const agreement = JSON.parse(fs.readFileSync(agreementPath, "utf8"));
  assert.equal(agreement.common_case_count, 30);
  assert.equal(agreement.metrics.detail_process.n, 30);
  assert.ok(
    agreement.metrics.relevance_score_1_to_5.weighted_kappa_quadratic !== null
  );


  const reviewA = buildReview("R1", false);
  const reviewAMap = new Map(
    reviewA.cases.map(item => [item.case_id, item])
  );
  const adjudication = JSON.parse(
    fs.readFileSync(adjudicationPath, "utf8")
  );
  adjudication.status = "confirmed";
  for (const item of adjudication.cases) {
    const source = reviewAMap.get(item.case_id);
    item.final_expected_detail_process = source.expected_detail_process;
    item.final_expected_primary_risk = source.expected_primary_risk;
    item.final_no_suitable_candidate = source.no_suitable_candidate;
    item.final_best_scenario_id = source.best_scenario_id;
    item.final_acceptable_scenario_ids = source.acceptable_scenario_ids;
    const scoreMap = new Map(
      source.candidate_ratings.map(rating => [
        String(rating.scenario_id),
        rating.relevance_score
      ])
    );
    for (const rating of item.scenario_relevance) {
      rating.final_relevance_score = scoreMap.get(
        String(rating.scenario_id)
      );
    }
  }
  writeJson(adjudicationPath, adjudication);


  run("evaluateScenarioResearchMetrics.js", [
    path.join(
      projectRoot,
      "results",
      "scenario_matching",
      "current_index_selector_results.json"
    ),
    "--gold",
    adjudicationPath,
    "--output",
    metricsPath
  ]);
  const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
  assert.equal(metrics.models.length, 1);
  assert.equal(metrics.models[0].hit_at_3.rate, 1);
  assert.equal(metrics.models[0].coverage.rate, 0.9);
  console.log("scenario-validation-workflow-ok");
} finally {
  const resolvedTemporaryDirectory = path.resolve(temporaryDirectory);
  if (
    resolvedTemporaryDirectory.startsWith(
      `${temporaryRoot}${path.sep}`
    )
  ) {
    fs.rmSync(resolvedTemporaryDirectory, {
      recursive: true,
      force: true
    });
  }
}
