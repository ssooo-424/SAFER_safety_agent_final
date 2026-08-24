// Educator 조건의 문구 조립 규칙을 다른 조건과 섞지 않기 위해 이 경계에 둔다.
function cleanText(value = "") {
  return String(value || "").trim();
}

function joinSafe(value, separator = ", ") {
  return Array.isArray(value) ? value.filter(Boolean).join(separator) : cleanText(value);
}

function formatSafetyRules(safetyRules = []) {
  return safetyRules
    .slice(0, 3)
    .map((rule, index) => {
      const action = cleanText(rule?.action);
      const comment = cleanText(rule?.comment);
      return `${index + 1}. ${action}${comment ? `\n   설명: ${comment}` : ""}`;
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
