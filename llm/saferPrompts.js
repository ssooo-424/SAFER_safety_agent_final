const educatorAgent = require("./safer_agents/educator");
const coworkerAgent = require("./safer_agents/coworker");
const futureSelfAgent = require("./safer_agents/futureSelf");

// server가 condition별 구현을 알지 않도록 router에서 Agent 선택만 담당한다.
const SAFER_AGENTS = {
  educator: educatorAgent,
  coworker: coworkerAgent,
  future_self: futureSelfAgent
};

function getSaferAgent(condition) {
  const agent = SAFER_AGENTS[condition];

  if (!agent) {
    throw new Error(`아직 구현되지 않은 SAFER condition입니다: ${condition}`);
  }

  return agent;
}

// 입력 기본값과 결과 형식은 Agent 계약을 그대로 전달해 condition 간 차이를 보존한다.
function buildSaferTurn0Greeting({ condition, profile = {}, safetyCase }) {
  const agent = getSaferAgent(condition);

  if (typeof agent.buildTurn0Greeting !== "function") {
    throw new Error(`Turn 0이 구현되지 않은 SAFER condition입니다: ${condition}`);
  }

  return agent.buildTurn0Greeting({ profile, safetyCase });
}

function buildSaferIntroMessages({
  condition,
  safetyCase,
  participantContext = {}
}) {
  return getSaferAgent(condition).buildIntroMessages({
    safetyCase,
    participantContext
  });
}

function getSaferTurn4Question({
  condition,
  safetyCase,
  participantContext = {}
}) {
  return getSaferAgent(condition).getTurn4Question({
    safetyCase,
    participantContext
  });
}

function buildSaferTurn5EvaluationMessages({
  condition,
  safetyCase,
  userMessage = ""
}) {
  return getSaferAgent(condition).buildTurn5EvaluationMessages({
    safetyCase,
    userMessage
  });
}

function buildSaferTurn5Feedback({
  condition,
  safetyCase,
  userMessage = "",
  evaluation = {},
  participantContext = {}
}) {
  return getSaferAgent(condition).buildTurn5Feedback({
    safetyCase,
    userMessage,
    evaluation,
    participantContext
  });
}

function buildSaferTurn6Feedback({ condition, safetyCase }) {
  return getSaferAgent(condition).buildTurn6Feedback({ safetyCase });
}

module.exports = {
  getSaferAgent,
  buildSaferTurn0Greeting,
  buildSaferIntroMessages,
  getSaferTurn4Question,
  buildSaferTurn5EvaluationMessages,
  buildSaferTurn5Feedback,
  buildSaferTurn6Feedback
};
