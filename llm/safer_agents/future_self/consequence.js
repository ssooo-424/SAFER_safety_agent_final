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

const { getRelationshipNarrative } = require("../../relationshipNarratives");

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
  const relationshipNarrative = getRelationshipNarrative(context.importantPerson);

  if (context.fatalOutcome) {
    relationshipMessage = relationshipNarrative.futureSelfFatal;

    livelihoodMessage = [
      "내 수입이 끊기고 장례와 생계 부담까지 감당할 수 없게 됐어.",
      "내가 쌓아온 경력과 앞으로 살아갈 기회도 그날 끝나버렸어."
    ].join("\n");
  } else {
    relationshipMessage = relationshipNarrative.futureSelf;

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
