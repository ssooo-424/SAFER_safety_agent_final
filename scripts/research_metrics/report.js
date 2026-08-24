const fs = require("fs");
const path = require("path");


function buildReport({ gold, goldPath, evaluations, pairwise }) {
  return {
    schema_version: "2.0",
    protocol_version: "scenario-human-review-v1",
    gold_status: gold.status || "unknown",
    gold_file: path.resolve(goldPath),
    interpretation: {
      hit_at_3:
        "Top-3 안에 사람이 허용한 시나리오가 하나라도 있는 사례 비율",
      precision_at_3:
        "제시한 후보 중 허용 시나리오가 차지하는 비율의 사례별 평균",
      recall_at_3:
        "사람이 허용한 시나리오 중 Top-3가 회수한 비율의 사례별 평균",
      mrr_at_3:
        "첫 허용 시나리오가 앞 순위에 있을수록 높은 값",
      ndcg_at_3:
        "1~5점 적합도를 반영한 순위 품질; 1에 가까울수록 이상적",
      mcnemar:
        "같은 30건에서 두 시스템의 성공/실패 차이를 보는 쌍체 검정"
    },
    models: evaluations,
    pairwise_comparisons: pairwise
  };
}


function writeReport(filePath, value) {
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


module.exports = {
  buildReport,
  writeReport
};
