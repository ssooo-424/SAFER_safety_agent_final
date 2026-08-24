const { cleanText } = require("./formatting");

// Turn 6은 LLM 결과가 아니라 검증된 세 safety rule을 그대로 요약한다.
function buildTurn6Feedback({ safetyCase }) {
  if (!safetyCase) {
    throw new Error("Turn 6 생성에 safetyCase가 필요합니다.");
  }

  const safetyRules = Array.isArray(safetyCase.safety_rules)
    ? safetyCase.safety_rules.slice(0, 3)
    : [];
  if (safetyRules.length !== 3) {
    throw new Error("Turn 6 requires exactly 3 safety_rules");
  }

  const ruleActions = safetyRules.map((rule, index) => {
    const action = cleanText(rule?.action);
    if (!action) {
      throw new Error(`Turn 6 safety_rule ${index + 1} action is empty`);
    }
    return action;
  });

  const lines = [
    "마지막으로 이번 사고를 예방하기 위한 핵심 안전수칙을 정리하겠습니다.",
    "",
    `1. ${ruleActions[0]}`,
    "",
    `2. ${ruleActions[1]}`,
    "",
    `3. ${ruleActions[2]}`,
    "",
    "세 가지를 모두 확인한 뒤, 현장에서 가장 자신 있게 지킬 수 있는 안전수칙 하나를 선택해 보세요."
  ];

  return {
    assistant: lines.join("\n"),
    safetyRules: ruleActions.map((action, index) => ({ rule_id: index + 1, action }))
  };
}

module.exports = { buildTurn6Feedback };
