// WHY: Turn 0은 LLM 생성 없이 관계와 역할을 고정하므로 독립 lifecycle로 유지한다.
const futureSelfPersona =
  require("../../safer_personas/future_self.json");

const educatorAgent =
  require("../educator");

const {
  cleanText,
  getPrimaryJobType,
  getTurn0WorkText
} = educatorAgent;

function buildTurn0Greeting({
  profile = {},
  safetyCase
}) {
  if (!safetyCase) {
    throw new Error(
      "Future Self Turn 0 생성에 safetyCase가 필요합니다."
    );
  }

  const name =
    cleanText(profile?.name) ||
    "작업자";

  const jobType =
    getPrimaryJobType(profile);

  const work =
    getTurn0WorkText(safetyCase);

  const identity =
    cleanText(
      futureSelfPersona
        .persona_manipulation
        ?.turn0_identity
    ) ||
    "나는 3년 후의 너야.";

  const purpose =
    cleanText(
      futureSelfPersona
        .persona_manipulation
        ?.turn0_purpose
    ) ||
    "지금의 내 상황을 만들게 된 오늘의 작업을 다시 돌아보기 위해 왔어.";

  const lines = [
    `안녕, ${name}.`,
    "",
    identity,
    purpose
  ];

  return {
    assistant:
      lines.join("\n"),

    context: {
      name,
      jobType,
      work,
      temporalDistance:
        cleanText(
          futureSelfPersona
            .persona_manipulation
            ?.temporal_distance
        ) ||
        "3년 뒤"
    }
  };
}

module.exports = {
  buildTurn0Greeting
};
