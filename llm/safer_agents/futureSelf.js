// Runtime router가 lifecycle module의 내부 구성을 알지 않도록 이 entrypoint에서 API를 고정한다.
const futureSelfPersona =
  require("../safer_personas/future_self.json");

const educatorAgent =
  require("./educator");

const {
  buildTurn0Greeting
} = require("./future_self/greeting");

const {
  getFutureInjury,
  buildFutureSelfParticipantContext,
  formatFutureSelfParticipantContext
} = require("./future_self/participantContext");

const {
  buildTurn3ConsequenceMessages,
  buildTurn3ConsequenceExtension
} = require("./future_self/consequence");

const {
  buildFutureSelfPersonaContext
} = require("./future_self/personaContext");

const {
  buildFutureSelfIntroSafetyCaseContext
} = require("./future_self/caseContext");

const {
  buildFutureSelfIntroSystemPrompt
} = require("./future_self/introSystemPrompt");

const {
  buildFutureSelfIntroUserPrompt
} = require("./future_self/introUserPrompt");

const {
  buildIntroMessages
} = require("./future_self/introMessages");

const {
  getTurn4Question,
  buildTurn5EvaluationMessages,
  buildTurn5Feedback,
  buildTurn6Feedback
} = require("./future_self/feedback");

const {
  cleanText,
  joinSafe,
  formatSafetyRules,
  formatSafetyRulesForEvaluation,
  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle,
  normalizeTurn5Evaluation
} = educatorAgent;

module.exports = {
  condition:
    "future_self",

  persona:
    futureSelfPersona,

  buildTurn0Greeting,
  buildIntroMessages,
  getTurn4Question,
  buildTurn5EvaluationMessages,
  buildTurn5Feedback,
  buildTurn6Feedback,

  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle,

  buildFutureSelfPersonaContext,
  getFutureInjury,
  buildFutureSelfParticipantContext,
  formatFutureSelfParticipantContext,
  buildTurn3ConsequenceMessages,
  buildTurn3ConsequenceExtension,
  buildFutureSelfIntroSafetyCaseContext,
  buildFutureSelfIntroSystemPrompt,
  buildFutureSelfIntroUserPrompt,

  buildFutureSelfTurn5EvaluationSystemPrompt:
    educatorAgent
      .buildEducatorTurn5EvaluationSystemPrompt,
  buildFutureSelfTurn5EvaluationUserPrompt:
    educatorAgent
      .buildEducatorTurn5EvaluationUserPrompt,
  normalizeTurn5Evaluation,

  formatSafetyRules,
  formatSafetyRulesForEvaluation,
  cleanText,
  joinSafe
};
