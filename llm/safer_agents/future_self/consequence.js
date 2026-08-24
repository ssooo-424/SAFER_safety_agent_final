// WHY: Turn 3 후속 문단은 server가 별도 결합하므로 생성 prompt와 분리해 순서를 고정한다.
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

function buildTurn3ConsequenceMessages({
  participantContext = {},
  safetyCase = {}
} = {}) {
  const context =
    buildFutureSelfParticipantContext(
      participantContext,
      safetyCase
    );

  let relationshipMessage;
  let livelihoodMessage;

  if (context.fatalOutcome) {
    relationshipMessage = [
      `내가 돌아오지 못한 뒤 ${context.importantPerson}의 일상까지 무너졌어.`,
      context.importantPersonDetail
        ? `${context.importantPersonDetail}에게 마지막 인사도 못 하고 모든 부담을 남겨서 너무 미안해.`
        : `${context.importantPerson}에게 마지막 인사도 못 하고 모든 부담을 남겨서 너무 미안해.`
    ].join("\n");

    livelihoodMessage = [
      `내 수입이 끊기고 장례와 생계 부담은 ${context.importantPerson}에게 남았어.`,
      "내가 쌓아온 경력과 앞으로 살아갈 기회도 그날 끝나버렸어."
    ].join("\n");
  } else {
    relationshipMessage = [
      `몸보다 더 괴로운 건 ${context.importantPerson}에게 짐이 된 거야.`,
      context.importantPersonDetail
        ? `${context.importantPersonDetail}에게 아픈 모습과 걱정만 남겨서 너무 미안해.`
        : `${context.importantPerson}에게 아픈 모습과 걱정만 남겨서 너무 미안해.`
    ].join("\n");

    livelihoodMessage = [
      "치료와 재활로 병원비는 쌓이고, 일을 못 해 생계가 막막해졌어.",
      "현장에 돌아가지 못하면서 지금까지 쌓아온 경력도 끊겼어."
    ].join("\n");
  }

  const reflectionMessage = [
    cleanText(
      futureSelfPersona
        .persona_manipulation
        ?.standardized_self_relevance
    ),
    cleanText(
      futureSelfPersona
        .persona_manipulation
        ?.standardized_imagery_question
    ) ||
    "이런 미래가 정말 네 일이 될 수 있다는 게 상상이 돼?"
  ]
    .filter(Boolean)
    .join("\n");

  return [
    relationshipMessage,
    livelihoodMessage,
    reflectionMessage
  ].filter(Boolean);
}

function buildTurn3ConsequenceExtension(
  options = {}
) {
  return buildTurn3ConsequenceMessages(
    options
  ).join("\n\n");
}

module.exports = {
  buildTurn3ConsequenceMessages,
  buildTurn3ConsequenceExtension
};
