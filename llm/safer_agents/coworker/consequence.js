const { getRelationshipNarrative } = require("../../relationshipNarratives");

function buildTurn3ConsequenceMessages({
  participantContext = {}
} = {}) {
  const profile = participantContext.profile || participantContext || {};
  const relationshipMessage = getRelationshipNarrative(profile.importantPerson).coworker;

  const livelihoodMessage = [
    "치료비가 계속 들고 일을 쉬게 되니 생계 부담도 커졌어.",
    "현장에 언제 돌아갈 수 있을지 몰라 지금까지 쌓아온 경력도 걱정됐어."
  ].join("\n");

  return [
    relationshipMessage,
    livelihoodMessage
  ];
}

module.exports = { buildTurn3ConsequenceMessages };
