// WHY: Intro 공개 API는 system과 user prompt를 동일 입력으로 조립하는 lifecycle seam이다.
const {
  buildFutureSelfIntroSystemPrompt
} = require("./introSystemPrompt");

const {
  buildFutureSelfIntroUserPrompt
} = require("./introUserPrompt");

function buildIntroMessages({
  safetyCase,
  participantContext = {}
}) {
  if (!safetyCase) {
    throw new Error(
      "Future Self Intro 생성에 safetyCase가 필요합니다."
    );
  }

  return [
    {
      role: "system",
      content:
        buildFutureSelfIntroSystemPrompt(
          safetyCase,
          participantContext
        )
    },
    {
      role: "user",
      content:
        buildFutureSelfIntroUserPrompt({
          participantContext,
          safetyCase
        })
    }
  ];
}

module.exports = {
  buildIntroMessages
};
