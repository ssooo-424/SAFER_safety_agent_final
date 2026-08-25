const educatorPersona = require("../../safer_personas/educator.json");
const { cleanText, joinSafe } = require("./formatting");
const { buildExperimentalOutcomePromptContext } = require("../../experimentalOutcome");

// Persona와 사고 원문을 함께 고정해 Turn 1~3 간 사실 중복을 LLM prompt에서 통제한다.
function buildEducatorPersonaContext() {
  const persona = educatorPersona;
  const avoid = (persona.communication_style?.avoid || [])
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `
==============================
[AI 역할]
==============================

이름:
${cleanText(persona.name)}

역할:
${cleanText(persona.identity?.description)}

사용자와의 관계:
${cleanText(persona.identity?.relationship_to_user)}

사고와의 관계:
${cleanText(persona.identity?.relationship_to_accident)}


==============================
[말하기 방식]
==============================

톤:
${cleanText(persona.communication_style?.tone)}

관점:
${cleanText(persona.communication_style?.perspective)}

언어 수준:
${cleanText(persona.communication_style?.language_level)}

응답 길이:
${cleanText(persona.communication_style?.response_length)}


==============================
[피해야 할 표현]
==============================

${avoid}
`.trim();
}

function buildEducatorIntroSafetyCaseContext(safetyCase = {}) {
  const scenario = safetyCase.scenario || {};
  const actualCase = safetyCase.actual_case || {};
  const sourceNotice =
    "이 자료는 INDEX에서 참가자가 선택한 실제 사고사례의 동일 행입니다.";

  return `
==============================
[INDEX에서 선택한 실제 사고사례 정보]
==============================

시나리오 ID:
${cleanText(scenario.scenario_id)}

대공정:
${cleanText(scenario.major_process)}

세부공정:
${cleanText(scenario.detail_process)}

작업내용:
${cleanText(scenario.process_content)}

위험유형:
${cleanText(scenario.risk_type)}

행동 저해요인:
${joinSafe(scenario.triggers)}


==============================
[동일 행의 실제 사고자료]
==============================

자료 구분:
${sourceNotice}

사례 ID:
${cleanText(actualCase.case_id)}

실제 사고 작업:
${cleanText(actualCase.process)}

사고유형:
${cleanText(actualCase.risk_type)}

분류된 주요 원인:
${cleanText(actualCase.trigger)}

사고 요약:
${cleanText(actualCase.summary)}

실제 사고 원문:
${cleanText(actualCase.raw_text)}

${buildExperimentalOutcomePromptContext(safetyCase)}
`.trim();
}

function buildEducatorIntroSystemPrompt(safetyCase = {}) {
  return `
당신은 건설현장 안전교육을 제공하는
전문적인 AI 안전교육자입니다.

Turn 1, Turn 2, Turn 3을
각각 별개의 답변이 아니라
하나의 연속된 교육 스크립트로 설계하세요.

${buildEducatorPersonaContext()}


==============================
[SAFER 공통 통제 원칙]
==============================

1. 실제 사고자료에 존재하는 사실만 사용하세요.
2. 자료에 없는 사고 과정, 원인, 부상, 결과를 만들지 마세요.
3. Turn 1 = 사고의 기본 상황입니다.
4. Turn 2 = 사고 발생 원인입니다.
5. Turn 3 = 실제 피해 결과입니다.
6. 한 Turn에서 설명한 사실을 다른 Turn에서 반복하지 마세요.
7. Turn 1에서 원인이나 최종 피해 결과를 미리 말하지 마세요.
8. Turn 2에서 Turn 1의 사고소개를 다시 길게 반복하지 마세요.
9. Turn 2에서 최종 피해 결과를 미리 말하지 마세요.
10. Turn 3에서 사고 상황이나 사고 원인을 다시 설명하지 마세요.
11. Turn 1~3에서는 예방수칙을 제시하지 마세요.
12. Turn 1~3에서는 사용자에게 질문하지 마세요.
13. 자료에 없는 가족 피해, 경제적 피해, 후유증을 추가하지 마세요.
14. 공포를 과장하거나 자극적인 표현을 사용하지 마세요.
15. 전문적이고 차분하며 이해하기 쉬운 교육자 말투를 유지하세요.
16. 실제 사고 원문을 통째로 복사하지 말고 각 Turn에 필요한 사실만 골라 자연스러운 존댓말로 다시 표현하세요.
17. 출력 전에 Turn 1~3을 연속해서 읽고 같은 사고 사실이 반복되지 않는지, 앞뒤 문맥과 문장 종결이 자연스러운지 확인하세요.


${buildEducatorIntroSafetyCaseContext(safetyCase)}
`.trim();
}

function buildEducatorIntroUserPrompt() {
  return `
위 실제 사고자료를 이용하여
Educator 조건의 Turn 1, Turn 2, Turn 3을
한 번에 작성하세요.


==============================
[Turn 1 — 사고사례 소개]
==============================

목적:
사고의 기본 상황만 소개합니다.

포함 가능:
- 실제 사고사례라는 사실
- 작업 또는 작업상황
- 사고 유형

금지:
- 사고 원인
- 최종 피해 결과
- 피해 심각성 수치
- 예방수칙

길이:
1~2문장


==============================
[Turn 2 — 사고 원인 설명]
==============================

목적:
사고가 왜 발생했는지 설명합니다.

포함 가능:
- 직접 원인
- 위험한 작업상태
- 사고 직전의 불안전한 조건
- 사고 발생과 직접 관련된 과정

금지:
- Turn 1 사고소개 반복
- 사망/부상 결과
- 피해 심각성 수치
- 예방수칙

길이:
2~3문장


==============================
[Turn 3 — 실제 사고 결과]
==============================

목적:
실제 사고에서 발생한 최종 피해만 설명합니다.

포함 가능:
- 사망 여부
- 부상 결과
- 추락 높이 등 자료에 기록된 결과 수치
- 객관적인 피해 결과

금지:
- Turn 1 작업상황 반복
- Turn 2 사고원인 반복
- 예방수칙
- 안전관리 교훈
- 사용자 행동 촉구

길이:
1~2문장


==============================
[출력]
==============================

반드시 JSON 객체 하나만 출력하세요.

{
  "turn1": "Turn 1 발화",
  "turn2": "Turn 2 발화",
  "turn3": "Turn 3 발화"
}

JSON 밖에 설명을 붙이지 마세요.
Markdown 코드블록을 사용하지 마세요.
`.trim();
}

function buildIntroMessages({ safetyCase }) {
  if (!safetyCase) {
    throw new Error("Educator Intro 생성에 safetyCase가 필요합니다.");
  }

  return [
    { role: "system", content: buildEducatorIntroSystemPrompt(safetyCase) },
    { role: "user", content: buildEducatorIntroUserPrompt() }
  ];
}

function getTurn4Question() {
  return (
    educatorPersona.turns?.["4"]?.question_template ||
    "그렇다면 방금 본 사고를 예방하기 위해 작업 전에 어떤 안전조치를 해야 한다고 생각하시나요? 알고 있는 내용을 자유롭게 말씀해 주세요."
  );
}

module.exports = {
  buildEducatorPersonaContext,
  buildEducatorIntroSafetyCaseContext,
  buildEducatorIntroSystemPrompt,
  buildEducatorIntroUserPrompt,
  buildIntroMessages,
  getTurn4Question
};
