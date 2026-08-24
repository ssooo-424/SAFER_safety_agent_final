// WHY: persona JSON을 prompt 문맥으로 직렬화하는 규칙은 다른 lifecycle과 독립적이다.
const futureSelfPersona =
  require("../../safer_personas/future_self.json");

const educatorAgent =
  require("../educator");

const {
  cleanText
} = educatorAgent;

function formatNumberedList(
  values = []
) {
  return values
    .map(
      (item, index) =>
        `${index + 1}. ${cleanText(item)}`
    )
    .filter(
      line =>
        !/\.\s*$/.test(line)
    )
    .join("\n");
}

function buildFutureSelfPersonaContext() {
  const persona =
    futureSelfPersona;

  const manipulation =
    persona.persona_manipulation ||
    {};

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
[Future Self 조건의 핵심 조작]
==============================

시간적 거리:
${cleanText(manipulation.temporal_distance)}

사회적 역할:
${cleanText(manipulation.social_role)}

핵심 심리적 요소:
${formatNumberedList(manipulation.core_mechanism)}


==============================
[사전에 고정된 조작 문장]
==============================

Turn 1 미래 관점 문장:
${cleanText(manipulation.standardized_intro_perspective)}

Turn 2 미래사고 전환 문장:
${cleanText(manipulation.standardized_future_transition)}

Turn 5 자기관련성 문장:
${cleanText(manipulation.standardized_self_relevance)}


==============================
[조작 사용 규칙]
==============================

${formatNumberedList(manipulation.manipulation_rule)}


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
[세부 말투 규칙]
==============================

${formatNumberedList(persona.communication_style?.speech_style)}


==============================
[피해야 할 표현]
==============================

${formatNumberedList(persona.communication_style?.avoid)}
`.trim();
}

module.exports = {
  buildFutureSelfPersonaContext
};
