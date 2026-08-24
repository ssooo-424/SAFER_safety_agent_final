const fs = require("fs");
const path = require("path");


function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(path.resolve(filePath), "utf8")
  );
}


function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), {
    recursive: true
  });
  fs.writeFileSync(
    resolved,
    JSON.stringify(value, null, 2),
    "utf8"
  );
  return resolved;
}


function getOption(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}


function inferExpectedRisk(consequence) {
  const text = String(consequence || "");
  if (/감전|활선|전기가 살아|누전/.test(text)) return "감전";
  if (/질식|산소 부족|물에 빠|익사/.test(text)) return "질식";
  if (/화상|화재|불티|착화/.test(text)) return "화상";
  if (/걸려 넘어|넘어져|넘어짐|미끄러/.test(text)) return "넘어짐";
  if (/매몰|깔림|깔려|붕괴|무너/.test(text)) return "깔림";
  if (/추락|아래로 떨어|발을 헛디|개구부/.test(text)) return "떨어짐";
  if (/끼임|끼어|끼일|협착|빨려들/.test(text)) return "끼임";
  if (/베이|베거나|절상|절단|찔림|찔려/.test(text)) return "절상";
  if (/충돌|부딪|맞아|가격|인양물.*(낙하|떨어)/.test(text)) {
    return "충돌 및 접촉";
  }
  if (/유해물질|분진|석면|호흡기|흡입|질환/.test(text)) return "질병";
  return null;
}


function main() {
  const inputPath = process.argv[2];
  const bundlePath = getOption("--bundle");
  const outputPath = getOption("--output");
  const rawOutputPath = getOption("--raw-output");
  const reportPath = getOption("--report");


  if (!inputPath || !bundlePath || !outputPath || !reportPath) {
    throw new Error(
      "사용법: node scripts/repairScenarioHumanReview.js <review.json> --bundle human_review_bundle.json --output corrected.json --report report.json [--raw-output raw.json]"
    );
  }


  const original = readJson(inputPath);
  const corrected = JSON.parse(JSON.stringify(original));
  const bundle = readJson(bundlePath);
  const bundleMap = new Map(
    (bundle.cases || []).map(item => [item.case_id, item])
  );
  const changes = [];
  const noteCounts = new Map();


  for (const item of corrected.cases || []) {
    const note = String(item.reviewer_note || "").trim();
    if (note) {
      noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
    }
  }


  for (const reviewCase of corrected.cases || []) {
    const bundleCase = bundleMap.get(reviewCase.case_id);
    if (!bundleCase) {
      throw new Error(`검토 번들에 없는 사례입니다: ${reviewCase.case_id}`);
    }
    const catalog = new Map(
      (bundleCase.review_candidates || []).map(item => [
        String(item.scenario_id),
        item
      ])
    );
    const ratings = (reviewCase.candidate_ratings || [])
      .filter(item => catalog.has(String(item.scenario_id)));
    const maximumScore = ratings.length > 0
      ? Math.max(...ratings.map(item => Number(item.relevance_score) || 0))
      : 0;
    const acceptedRatings = ratings.filter(item =>
      Number(item.relevance_score) >= 4
    );
    const currentBest = ratings.find(item =>
      String(item.scenario_id) === String(reviewCase.best_scenario_id)
    );
    const bestRating = maximumScore >= 4
      ? currentBest && Number(currentBest.relevance_score) === maximumScore
        ? currentBest
        : ratings.find(item => Number(item.relevance_score) === maximumScore)
      : null;


    const before = {
      expected_detail_process: reviewCase.expected_detail_process,
      expected_primary_risk: reviewCase.expected_primary_risk,
      no_suitable_candidate: reviewCase.no_suitable_candidate,
      best_scenario_id: reviewCase.best_scenario_id,
      acceptable_scenario_ids: reviewCase.acceptable_scenario_ids || []
    };
    const selectedCandidate = bestRating
      ? catalog.get(String(bestRating.scenario_id))
      : null;


    reviewCase.no_suitable_candidate = !selectedCandidate;
    reviewCase.best_scenario_id = selectedCandidate
      ? selectedCandidate.scenario_id
      : null;
    reviewCase.acceptable_scenario_ids = acceptedRatings.map(item => {
      const candidate = catalog.get(String(item.scenario_id));
      return candidate.scenario_id;
    });
    for (const rating of ratings) {
      rating.acceptable = Number(rating.relevance_score) >= 4;
    }
    reviewCase.expected_detail_process =
      bundleCase.reference_detail_process ||
      (selectedCandidate ? selectedCandidate.detail_process : null);
    reviewCase.expected_primary_risk = selectedCandidate
      ? selectedCandidate.primary_risk_type
      : inferExpectedRisk(
          bundleCase.input && bundleCase.input.consequence
        );
    reviewCase.scenario_match_evaluable =
      bundleCase.scenario_match_evaluable !== false;
    reviewCase.evaluability_rule =
      bundleCase.evaluability_rule ||
      "unknown";


    const note = String(reviewCase.reviewer_note || "").trim();
    if (note && noteCounts.get(note) > 1) {
      reviewCase.reviewer_note = "";
      changes.push({
        case_id: reviewCase.case_id,
        action: "removed_duplicated_note_caused_by_ui_handler_accumulation"
      });
    }


    const after = {
      expected_detail_process: reviewCase.expected_detail_process,
      expected_primary_risk: reviewCase.expected_primary_risk,
      no_suitable_candidate: reviewCase.no_suitable_candidate,
      best_scenario_id: reviewCase.best_scenario_id,
      acceptable_scenario_ids: reviewCase.acceptable_scenario_ids,
      scenario_match_evaluable: reviewCase.scenario_match_evaluable
    };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({
        case_id: reviewCase.case_id,
        action: "reconstructed_from_candidate_relevance_scores",
        before,
        after
      });
    }
  }


  corrected.postprocessing = {
    method: "human_review_ui_recovery_v1",
    source_file: path.resolve(inputPath),
    bundle_file: path.resolve(bundlePath),
    repaired_at: new Date().toISOString(),
    policy: [
      "후보 점수 4~5를 수용 가능으로 통일",
      "최고 점수 후보를 가장 적합 후보로 사용",
      "최고 점수가 4 미만이면 적합 후보 없음으로 처리",
      "최종 후보의 원본 태그로 세부공정과 사고유형 복원",
      "예상 결과에 구체 사고 또는 메커니즘이 없는 사례는 검색 성능 평가에서 제외 표시"
    ]
  };


  const savedRawPath = rawOutputPath
    ? writeJson(rawOutputPath, original)
    : null;
  const savedOutputPath = writeJson(outputPath, corrected);
  const savedReportPath = writeJson(reportPath, {
    schema_version: "1.0",
    method: "human_review_ui_recovery_v1",
    source_file: path.resolve(inputPath),
    corrected_file: savedOutputPath,
    changed_case_ids: [
      ...new Set(changes.map(item => item.case_id))
    ],
    excluded_from_scenario_metrics: corrected.cases
      .filter(item => item.scenario_match_evaluable === false)
      .map(item => item.case_id),
    changes
  });


  console.log(JSON.stringify({
    savedRawPath,
    savedOutputPath,
    savedReportPath,
    changed_case_count: new Set(changes.map(item => item.case_id)).size,
    no_suitable_case_ids: corrected.cases
      .filter(item => item.no_suitable_candidate)
      .map(item => item.case_id),
    excluded_from_scenario_metrics: corrected.cases
      .filter(item => item.scenario_match_evaluable === false)
      .map(item => item.case_id)
  }, null, 2));
}


try {
  main();
} catch (error) {
  console.error(`사람 검토 결과 복원 실패: ${error.message}`);
  process.exitCode = 1;
}
