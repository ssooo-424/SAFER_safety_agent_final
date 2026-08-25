// WHY: User prompt는 Turn 1~3 출력 schema와 개인화 지시를 소유하는 생성 contract다.
const futureSelfPersona =
  require("../../safer_personas/future_self.json");

const educatorAgent =
  require("../educator");

const {
  cleanText
} = educatorAgent;

const {
  buildFutureSelfParticipantContext
} = require("./participantContext");

function buildFutureSelfIntroUserPrompt({
  participantContext = {},
  safetyCase = {}
} = {}) {
  const manipulation =
    futureSelfPersona
      .persona_manipulation ||
    {};

  const introPerspective =
    cleanText(
      manipulation
        .standardized_intro_perspective
    );

  const futureTransition =
    cleanText(
      manipulation
        .standardized_future_transition
    );

  const context =
    buildFutureSelfParticipantContext(
      participantContext,
      safetyCase
    );

  const turn3InjuryInstructions =
    context.fatalOutcome
      ? `3. 사고자료에 사망 결과가 있으므로 그 결과를 그대로 유지하세요.
4. 사망과 양립할 수 없는 고정 부상, 치료, 재활 또는 생존 이후의 일상 제약을 추가하지 마세요.
5. 그 사고로 내가 평범한 일상으로 돌아가지 못했다는 결과를 강하게 전달하세요.
6. 가족·관계·생계·커리어 피해는 Turn 3 뒤에 고정 문단으로 결합되므로 생성문에는 넣지 마세요.`
      : `3. "${context.injury.part}" 부상과 "${context.injury.symptom}"를 그대로 반영하세요.
4. 이 부상 때문에 씻기, 밥 먹기, 이동하기 같은 평범한 일상이 어려워진 모습을 묘사하세요.
5. 가족·관계·병원비·생계·커리어 피해는 Turn 3 뒤에 고정 문단으로 결합되므로 생성문에는 넣지 마세요.`;

  return `
위 실제 사고자료와 Future Self 개인화 입력을 이용하여
Future Self 조건의 Turn 1, Turn 2, Turn 3을
한 번에 작성하세요.


==============================
[Turn 1 - 미래의 내가 겪은 사고 상황 + 미래자아 관계]
==============================

사고자료의 기본 상황을 미래의 내가 직접 겪은 일로 1인칭 회상하고
아래 고정 미래 관점 문장을 정확히 한 번 사용하세요.

"${introPerspective}"

금지:
- 실제 사고 원인
- 미끄러짐, 균형 상실, 안전시설 미설치 등 사고 발생 기전
- 실제 사고 최종 피해 결과
- 미래사고의 피해 결과
- 예방수칙
- "실제 사고사례", "해당 작업자", "사고 피해자" 같은 제3자 표현

길이:
2~3문장


==============================
[Turn 2 - 내가 겪은 사고원인 + 미래의 잘못된 선택]
==============================

먼저 사고자료에 기록된 원인을 내가 겪은 일로 1인칭 설명하세요.
다음 순서를 지키세요.

1. 사고자료에 기록된 직접 원인, 위험한 상태, 사고 발생 과정을 1~2문장으로 구체적으로 설명합니다.
2. "${context.triggers}"라는 압박이나 저해요인이 당시 어떤 판단을 만들었는지 설명합니다.
3. "${context.feeling}"라는 감정 때문에 위험 신호를 어떻게 가볍게 여기거나 작업을 강행했는지 회상합니다.
4. 사고자료에 안전 확인 누락이나 불안전한 행동이 기록되어 있다면 그 선택을 구체적으로 말합니다. 기록에 없다면 새 행동을 만들지 않습니다.
5. 아래 고정 미래사고 전환 문장을 마지막 문장으로 정확히 한 번 사용합니다.

아래 고정 미래사고 전환 문장을 정확히 한 번 사용하세요.

"${futureTransition}"

금지:
- Turn 1 사고소개 반복
- 실제 또는 미래사고의 사망·부상 결과
- 예방수칙
- 제공되지 않은 강행 이유

길이:
4~5문장


==============================
[Turn 3 - 내가 겪은 사고 결과 + 신체적 고통]
==============================

1. 실제 사고자료에 기록된 최종 피해 결과를 미래의 내가 겪은 결과로 먼저 1문장으로 설명하세요.
2. 별도의 사고나 비슷한 사고로 분리하지 말고 처음부터 이어지는 하나의 미래사고로 서술하세요.
${turn3InjuryInstructions}

가상 미래사고의 신체적 고통은 강하고 구체적으로 전달하세요.
다만 현재의 사용자를 비난하거나 모욕하지 마세요.

길이:
2~3문장. 같은 의미를 반복하지 말고 핵심 부상과 대표적인 일상 제약만 말하세요.


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

module.exports = {
  buildFutureSelfIntroUserPrompt
};
