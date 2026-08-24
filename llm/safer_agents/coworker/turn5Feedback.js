// Turn 5의 사용자 표시 결과는 LLM 원문이 아니라 normalized coverage로만 만든다.
const { cleanText } = require("./shared");
const { normalizeTurn5Evaluation } = require("./turn5Evaluation");

function getKoreanRuleCountLabel(count) {
  if (count === 1) return "한 가지";
  if (count === 2) return "두 가지";
  if (count === 3) return "세 가지";
  return `${count}가지`;
}

function joinCoveredAcknowledgements(items = []) {
  return items.map((item) => cleanText(item.action)).filter(Boolean).join(", ");
}

function buildTurn5Feedback({ safetyCase, userMessage = "", evaluation = {} }) {
  const coverage = normalizeTurn5Evaluation(evaluation, safetyCase);
  const covered = coverage.filter((item) => item.status === "covered");
  const missing = coverage.filter((item) => item.status === "not_covered");
  const lines = [];

  if (covered.length > 0) {
    const coveredText = joinCoveredAcknowledgements(covered);
    lines.push(`맞아. 네가 말한 ${coveredText}이 중요한 예방조치야.`);

    if (missing.length > 0) {
      lines.push("");
      lines.push(
        `그리고 ${getKoreanRuleCountLabel(missing.length)} 더 같이 기억해두면 좋아.`
      );
      lines.push("");
      missing.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.action}`);
      });
      lines.push("");
      lines.push("이 수칙들은 우리 작업 전에 같이 챙기는 게 중요해.");
    } else {
      lines.push("");
      lines.push("세 가지 핵심 안전수칙을 다 잘 짚었어.");
      lines.push("");
      lines.push("이 세 가지는 우리 작업 전에 꼭 같이 확인하자.");
    }
  } else {
    const normalizedUser = cleanText(userMessage);
    const doesNotKnow =
      !normalizedUser ||
      /모르겠|잘 모르|생각이 안|생각나지 않|없습니다|몰라/.test(normalizedUser);
    lines.push(
      doesNotKnow
        ? "괜찮아. 이런 사고를 막으려면 우리 같이 다음 세 가지를 기억해두자."
        : "말해준 내용은 확인했어. 이런 사고를 막으려면 우리 같이 다음 세 가지를 기억해두자."
    );
    lines.push("");
    coverage.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.action}`);
    });
    lines.push("");
    lines.push("이 수칙들은 작업 전에 우리 같이 챙기는 게 중요해.");
  }

  return {
    assistant: lines.join("\n"),
    coverage,
    coveredRuleIds: covered.map((item) => item.rule_id),
    missingRuleIds: missing.map((item) => item.rule_id),
    coveredCount: covered.length,
    missingCount: missing.length
  };
}

module.exports = { buildTurn5Feedback };
