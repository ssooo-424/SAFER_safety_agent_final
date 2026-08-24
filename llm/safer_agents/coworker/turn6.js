// Turn 6은 세 규칙을 검증한 뒤 deterministic 최종 응답만 만든다.
const { cleanText } = require("./shared");

function buildTurn6Feedback({ safetyCase }) {
  if (!safetyCase) {
    throw new Error("Coworker Turn 6 생성에 safetyCase가 필요합니다.");
  }
  const safetyRules = Array.isArray(safetyCase.safety_rules)
    ? safetyCase.safety_rules.slice(0, 3)
    : [];
  if (safetyRules.length !== 3) {
    throw new Error("Coworker Turn 6 requires exactly 3 safety_rules");
  }
  const ruleActions = safetyRules.map((rule, index) => {
    const action = cleanText(rule?.action);
    if (!action) {
      throw new Error(
        `Coworker Turn 6 safety_rule ${index + 1} action is empty`
      );
    }
    return action;
  });
  const lines = [
    "마지막으로 우리 같이 기억할 핵심 안전수칙 세 가지만 정리할게.",
    "",
    `1. ${ruleActions[0]}`,
    "",
    `2. ${ruleActions[1]}`,
    "",
    `3. ${ruleActions[2]}`,
    "",
    "세 가지를 모두 확인한 뒤, 현장에서 가장 자신 있게 지킬 수 있는 안전수칙 하나를 골라보자."
  ];
  return {
    assistant: lines.join("\n"),
    safetyRules: ruleActions.map((action, index) => ({
      rule_id: index + 1,
      action
    }))
  };
}

module.exports = { buildTurn6Feedback };
