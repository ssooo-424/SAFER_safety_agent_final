const path = require("path");

const { deterministicShuffle } = require("./deterministic_order");
const { writeJson } = require("./input");

function buildAiPacket(baseCases, orderCode) {
  return {
    schema_version: "2.0",
    prompt_version: "scenario-independent-ranking-v2",
    packet_order: orderCode,
    privacy_note:
      "이름, 소속, 가족 정보는 매칭에 불필요하여 제거되었습니다.",
    selection_rule:
      "각 사례에서 제공된 eligible_candidates 안에서만 최대 3개를 독립적으로 순위화합니다.",
    cases: baseCases.map(item => ({
      case_id: item.case_id,
      test_tag: item.test_tag,
      input: item.input,
      scenario_match_evaluable: item.scenario_match_evaluable,
      evaluability_rule: item.evaluability_rule,
      reference_detail_process: item.reference_detail_process,
      allowed_detail_processes: item.allowed_detail_processes,
      eligible_candidates: deterministicShuffle(
        item.eligible_candidates,
        `${orderCode}:${item.case_id}`
      )
    }))
  };
}

function buildHumanBundle(baseCases, modelResults, riskTypes) {
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    generated_at: new Date().toISOString(),
    candidate_pooling:
      "입력된 모든 시스템의 Top-3 합집합을 익명 검토합니다.",
    source_systems: modelResults.map((item, index) => ({
      system_code: `SYSTEM_${String.fromCharCode(65 + index)}`,
      model: item.model,
      file_path: item.file_path
    })),
    risk_types: riskTypes,
    cases: baseCases.map(item => ({
      case_id: item.case_id,
      test_tag: item.test_tag,
      input: item.input,
      scenario_match_evaluable: item.scenario_match_evaluable,
      evaluability_rule: item.evaluability_rule,
      reference_detail_process: item.reference_detail_process,
      allowed_detail_processes: item.allowed_detail_processes,
      allowed_risk_types: item.allowed_risk_types,
      review_candidates: item.pooled_candidates,
      source_rankings: item.source_rankings
    }))
  };
}

function buildReviewerTemplate(humanBundle) {
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    reviewer_id: "",
    reviewer_expertise: "",
    review_status: "draft",
    completed_at: null,
    cases: humanBundle.cases.map(item => ({
      case_id: item.case_id,
      scenario_match_evaluable: item.scenario_match_evaluable,
      evaluability_rule: item.evaluability_rule,
      reference_detail_process: item.reference_detail_process,
      expected_detail_process: null,
      expected_primary_risk: null,
      no_suitable_candidate: false,
      best_scenario_id: null,
      acceptable_scenario_ids: [],
      candidate_ratings: item.review_candidates.map(candidate => ({
        scenario_id: candidate.scenario_id,
        relevance_score: null,
        acceptable: null,
        note: ""
      })),
      reviewer_note: ""
    }))
  };
}

function writePackets(options) {
  const { baseCases, humanBundle, outputDir, publicBundlePath } = options;
  const paths = {
    aiPacketAPath: path.join(outputDir, "ai_selector_packet_a.json"),
    aiPacketBPath: path.join(outputDir, "ai_selector_packet_b.json"),
    humanBundlePath: path.join(outputDir, "human_review_bundle.json"),
    reviewerTemplatePath: path.join(outputDir, "reviewer_template.json")
  };
  writeJson(paths.aiPacketAPath, buildAiPacket(baseCases, "A"));
  writeJson(paths.aiPacketBPath, buildAiPacket(baseCases, "B"));
  writeJson(paths.humanBundlePath, humanBundle);
  writeJson(paths.reviewerTemplatePath, buildReviewerTemplate(humanBundle));
  writeJson(publicBundlePath, humanBundle);
  return paths;
}

module.exports = { buildHumanBundle, writePackets };
