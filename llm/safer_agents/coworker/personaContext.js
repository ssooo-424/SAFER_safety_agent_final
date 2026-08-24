// 모든 prompt가 동일한 persona snapshot을 사용하도록 context 생성을 한곳에 둔다.
const coworkerPersona = require("../../safer_personas/coworker.json");
const { cleanText } = require("./shared");

function numbered(items = []) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildCoworkerPersonaContext() {
  const persona = coworkerPersona;
  const avoid = numbered(persona.communication_style?.avoid || []);
  const speechStyle = numbered(persona.communication_style?.speech_style || []);
  const mechanisms = numbered(persona.persona_manipulation?.core_mechanism || []);
  const experienceRules = numbered(persona.persona_manipulation?.experience_rule || []);
  const standardizedExperience = cleanText(
    persona.persona_manipulation?.standardized_peer_experience
  );

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
[Coworker 조건의 핵심 조작]
==============================

사회적 역할:
${cleanText(persona.persona_manipulation?.social_role)}

핵심 심리적 요소:
${mechanisms}


==============================
[사전에 고정된 동료 경험]
==============================

${standardizedExperience}


==============================
[동료 경험 사용 규칙]
==============================

${experienceRules}


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

${speechStyle}


==============================
[피해야 할 표현]
==============================

${avoid}
`.trim();
}

module.exports = { buildCoworkerPersonaContext };
