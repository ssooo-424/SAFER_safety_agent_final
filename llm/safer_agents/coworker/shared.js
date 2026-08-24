// 여러 lifecycle이 같은 입력 정규화 규칙을 써야 출력이 달라지지 않는다.
function cleanText(value = "") {
  return String(value || "").trim();
}

function joinSafe(value, separator = ", ") {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(separator);
  }
  return cleanText(value);
}

function formatSafetyRules(safetyRules = []) {
  return safetyRules
    .slice(0, 3)
    .map((rule, index) => {
      const action = cleanText(rule?.action);
      const comment = cleanText(rule?.comment);
      let text = `${index + 1}. ${action}`;
      if (comment) text += `\n   설명: ${comment}`;
      return text;
    })
    .join("\n\n");
}

function formatSafetyRulesForEvaluation(safetyRules = []) {
  return safetyRules
    .slice(0, 3)
    .map((rule, index) => `${index + 1}. ${cleanText(rule?.action)}`)
    .join("\n\n");
}

module.exports = {
  cleanText,
  joinSafe,
  formatSafetyRules,
  formatSafetyRulesForEvaluation
};
