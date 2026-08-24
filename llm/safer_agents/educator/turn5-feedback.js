const { cleanText } = require("./formatting");
const { normalizeTurn5Evaluation } = require("./turn5-evaluation");

function getKoreanRuleCountLabel(count) {
  if (count === 1) return "한 가지";
  if (count === 2) return "두 가지";
  if (count === 3) return "세 가지";
  return `${count}가지`;
}

function joinCoveredAcknowledgements(items = []) {
  return items.map((item) => cleanText(item.action)).filter(Boolean).join(", ");
}

// 평가 JSON이 사용자에게 직접 노출되지 않도록 검증된 action만 문장에 넣는다.
function buildTurn5Feedback({ safetyCase, userMessage = "", evaluation = {} }) {
  const coverage = normalizeTurn5Evaluation(evaluation, safetyCase);
  const covered = coverage.filter((item) => item.status === "covered");
  const missing = coverage.filter((item) => item.status === "not_covered");
  const lines = [];

  if (covered.length > 0) {
    const coveredText = joinCoveredAcknowledgements(covered);
    lines.push(
      `맞습니다. 말씀하신 대로 ${coveredText}을 통해 이와 같은 사고를 예방할 수 있습니다.`
    );

    if (missing.length > 0) {
      lines.push("");
      lines.push(
        `이외에도 ${getKoreanRuleCountLabel(missing.length)} 안전수칙을 기억하시는 게 중요합니다.`
      );
      lines.push("");
      missing.forEach((item, index) => lines.push(`${index + 1}. ${item.action}`));
    } else {
      lines.push("");
      lines.push("세 가지 핵심 안전수칙을 모두 잘 말씀해주셨습니다.");
    }
  } else {
    const normalizedUser = cleanText(userMessage);
    const doesNotKnow =
      !normalizedUser || /모르겠|잘 모르|생각이 안|생각나지 않|없습니다/.test(normalizedUser);

    lines.push(
      doesNotKnow
        ? "괜찮습니다. 이 사고를 예방하기 위해서는 다음 세 가지 안전수칙을 기억하는 것이 중요합니다."
        : "말씀해주신 내용을 확인했습니다. 이 사고를 예방하기 위해서는 다음 세 가지 안전수칙을 기억하는 것이 중요합니다."
    );
    lines.push("");
    coverage.forEach((item, index) => lines.push(`${index + 1}. ${item.action}`));
  }

  lines.push("");
  lines.push("이 안전수칙을 모두 기억하고 실천하는 것이 중요합니다.");

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
