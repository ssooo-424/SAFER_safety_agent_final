// Turn 5의 LLM 판정 contract와 normalization은 함께 변경되어야 한다.
const { cleanText, formatSafetyRulesForEvaluation } = require("./shared");

function buildCoworkerTurn5EvaluationSystemPrompt(safetyCase = {}) {
  const safetyRules = safetyCase.safety_rules || [];
  return `
당신은 건설현장에서 사용자와 함께 일하는
"동료 작업자 AI"입니다.

현재 단계에서는 사용자에게 보여줄
최종 피드백을 작성하지 않습니다.

오직 아래 3개의 safety_rules 각각에 대해
사용자의 자유응답이 핵심 안전행동을 의미상 포함하는지
covered / not_covered로 판정하세요.


==============================
[현재 사고의 정답 안전수칙]
==============================

${formatSafetyRulesForEvaluation(safetyRules)}


==============================
[판정 원칙]
==============================

1. 정확한 문장 일치를 요구하지 마세요.
2. 단순 키워드 일치만으로 covered라고 판단하지 마세요.
3. 현장 표현, 축약 표현, 일상 표현이어도 핵심 예방행동을 분명히 의미하면 covered입니다.
4. 원문의 모든 조건과 세부 절차를 그대로 재현할 필요는 없습니다.
5. 중심 예방행동을 명확히 말하면 covered입니다.
6. 하나의 rule에 여러 세부 행동이 있어도 핵심 보호조치를 특정했다면 covered입니다.

7. 다음처럼 지나치게 일반적인 표현은 covered가 아닙니다.
- 조심해야 한다
- 안전하게 해야 한다
- 규칙을 지켜야 한다
- 안전가시설을 해야 한다
- 보호조치를 해야 한다

8. safety_rules에 없는 아이디어를 억지로 연결하지 마세요.
9. 세 rule을 독립적으로 판단하세요.
10. 하나의 답변이 여러 rule을 포함하면 각각 covered로 판단하세요.


==============================
[출력]
==============================

반드시 JSON 객체 하나만 출력하세요.

{
  "coverage": [
    {
      "rule_id": 1,
      "status": "covered",
      "acknowledgement": "중심 행동을 ~하는 것 형태로 표현",
      "summary": "동료 말투의 간결한 문장",
      "evidence": "사용자 답변 근거"
    },
    {
      "rule_id": 2,
      "status": "not_covered",
      "acknowledgement": "중심 행동을 ~하는 것 형태로 표현",
      "summary": "동료 말투의 간결한 문장",
      "evidence": ""
    },
    {
      "rule_id": 3,
      "status": "not_covered",
      "acknowledgement": "중심 행동을 ~하는 것 형태로 표현",
      "summary": "동료 말투의 간결한 문장",
      "evidence": ""
    }
  ]
}

coverage는 정확히 3개입니다.
status는 covered 또는 not_covered만 사용합니다.
JSON 밖에 설명을 붙이지 마세요.
`.trim();
}

function buildCoworkerTurn5EvaluationUserPrompt(userMessage = "") {
  return `
다음은 사용자가 Turn 4에서 자유롭게 답한 내용입니다.

[사용자 답변]

"${cleanText(userMessage) || "모르겠습니다."}"

이 답변을 safety_rules 1, 2, 3과
각각 독립적으로 의미 비교하여
지정된 JSON 형식으로만 판정하세요.
`.trim();
}

function buildTurn5EvaluationMessages({ safetyCase, userMessage = "" }) {
  if (!safetyCase) {
    throw new Error("Coworker Turn 5 평가에 safetyCase가 필요합니다.");
  }
  return [
    {
      role: "system",
      content: buildCoworkerTurn5EvaluationSystemPrompt(safetyCase)
    },
    {
      role: "user",
      content: buildCoworkerTurn5EvaluationUserPrompt(userMessage)
    }
  ];
}

function normalizeTurn5Evaluation(evaluation = {}, safetyCase = {}) {
  const safetyRules = (safetyCase.safety_rules || []).slice(0, 3);
  const rawCoverage = Array.isArray(evaluation?.coverage)
    ? evaluation.coverage
    : [];

  return safetyRules.map((rule, index) => {
    const ruleId = index + 1;
    const found =
      rawCoverage.find((item) => Number(item?.rule_id) === ruleId) || {};
    const status = found.status === "covered" ? "covered" : "not_covered";
    const fallback = cleanText(rule?.action);
    return {
      rule_id: ruleId,
      status,
      action: fallback,
      acknowledgement: cleanText(found.acknowledgement) || fallback,
      summary: cleanText(found.summary) || fallback,
      evidence: status === "covered" ? cleanText(found.evidence) : ""
    };
  });
}

module.exports = {
  buildTurn5EvaluationMessages,
  buildCoworkerTurn5EvaluationSystemPrompt,
  buildCoworkerTurn5EvaluationUserPrompt,
  normalizeTurn5Evaluation
};
