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


function unique(values) {
  return [...new Set(values)];
}


function main() {
  const inputPath = process.argv[2];
  const packetPath = getOption("--packet");
  const outputPath = getOption("--output");
  const rawOutputPath = getOption("--raw-output");
  const reportPath = getOption("--report");


  if (!inputPath || !packetPath || !outputPath || !reportPath) {
    throw new Error(
      "사용법: node scripts/repairScenarioModelResult.js <input.json> --packet packet.json --output corrected.json --report repair_report.json [--raw-output raw.json]"
    );
  }


  const original = readJson(inputPath);
  const corrected = JSON.parse(JSON.stringify(original));
  const packet = readJson(packetPath);
  const packetMap = new Map(
    (packet.cases || []).map(item => [item.case_id, item])
  );
  const changes = [];


  for (const resultCase of corrected.cases || []) {
    const packetCase = packetMap.get(resultCase.case_id);
    if (!packetCase) {
      throw new Error(`패킷에 없는 사례입니다: ${resultCase.case_id}`);
    }
    const allowedDetails = packetCase.allowed_detail_processes || [];
    const catalog = new Map(
      (packetCase.eligible_candidates || []).map(item => [
        String(item.scenario_id),
        item
      ])
    );
    const beforeDetail = resultCase.prediction.detail_process;
    let correctedDetail = beforeDetail;


    if (!allowedDetails.includes(correctedDetail)) {
      if (allowedDetails.length === 1) {
        correctedDetail = allowedDetails[0];
        changes.push({
          case_id: resultCase.case_id,
          field: "prediction.detail_process",
          action: "normalized_to_only_allowed_detail",
          before: beforeDetail,
          after: correctedDetail
        });
      } else {
        throw new Error(
          `${resultCase.case_id}의 세부공정 '${beforeDetail}'은 허용 목록에 없고 자동 확정할 수 없습니다.`
        );
      }
    }


    resultCase.prediction.detail_process = correctedDetail;
    const beforeIds = resultCase.prediction.candidate_scenario_ids || [];
    const beforeAssessmentMap = new Map(
      (resultCase.candidate_assessments || []).map(item => [
        String(item.scenario_id),
        item
      ])
    );
    const retainedIds = unique(beforeIds)
      .filter(id => {
        const candidate = catalog.get(String(id));
        return candidate &&
          candidate.detail_process === correctedDetail;
      })
      .slice(0, 3);
    const removedIds = beforeIds.filter(id =>
      !retainedIds.map(String).includes(String(id))
    );


    if (removedIds.length > 0) {
      changes.push({
        case_id: resultCase.case_id,
        field: "prediction.candidate_scenario_ids",
        action: "removed_candidates_outside_selected_detail",
        selected_detail: correctedDetail,
        removed_ids: removedIds,
        retained_ids: retainedIds
      });
      resultCase.needs_human_review = true;
    }


    resultCase.prediction.candidate_scenario_ids = retainedIds;
    resultCase.prediction.candidate_risk_types = retainedIds.map(id =>
      catalog.get(String(id)).primary_risk_type
    );
    resultCase.candidate_assessments = retainedIds.map(id => {
      const existing = beforeAssessmentMap.get(String(id));
      return existing || {
        scenario_id: id,
        relevance_score: 3,
        reason: "기존 모델 출력에 평가가 없어 사람 확인 필요"
      };
    });


    const topScore = resultCase.candidate_assessments[0]
      ? resultCase.candidate_assessments[0].relevance_score
      : null;
    if (retainedIds.length === 0) {
      resultCase.needs_human_review = true;
      changes.push({
        case_id: resultCase.case_id,
        field: "needs_human_review",
        action: "marked_true_because_no_candidate_remained"
      });
    } else if (topScore <= 3 && resultCase.needs_human_review !== true) {
      resultCase.needs_human_review = true;
      changes.push({
        case_id: resultCase.case_id,
        field: "needs_human_review",
        action: "marked_true_because_top_score_is_3_or_lower",
        top_score: topScore
      });
    }
  }


  corrected.postprocessing = {
    method: "conservative_schema_repair_v1",
    source_file: path.resolve(inputPath),
    packet_file: path.resolve(packetPath),
    repaired_at: new Date().toISOString(),
    policy: [
      "원 모델이 선택한 후보만 유지하고 새 시나리오를 추가하지 않음",
      "선택한 세부공정과 동일한 후보만 유지",
      "허용 세부공정이 하나뿐일 때만 잘못된 명칭을 자동 정규화",
      "후보가 없거나 최고 적합도가 3 이하이면 사람 검토 대상으로 표시"
    ],
    changed_case_ids: unique(changes.map(item => item.case_id))
  };


  const savedRawPath = rawOutputPath
    ? writeJson(rawOutputPath, original)
    : null;
  const savedOutputPath = writeJson(outputPath, corrected);
  const savedReportPath = writeJson(reportPath, {
    schema_version: "1.0",
    method: "conservative_schema_repair_v1",
    source_file: path.resolve(inputPath),
    corrected_file: savedOutputPath,
    changed_case_count: unique(changes.map(item => item.case_id)).length,
    changes
  });


  console.log(JSON.stringify({
    savedRawPath,
    savedOutputPath,
    savedReportPath,
    changed_case_ids: corrected.postprocessing.changed_case_ids,
    change_count: changes.length
  }, null, 2));
}


try {
  main();
} catch (error) {
  console.error(`모델 결과 보수적 정리 실패: ${error.message}`);
  process.exitCode = 1;
}
