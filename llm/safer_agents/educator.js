const educatorPersona = require("../safer_personas/educator.json");
const formatting = require("./educator/formatting");
const turn0 = require("./educator/turn0");
const intro = require("./educator/intro");
const turn5Evaluation = require("./educator/turn5-evaluation");
const turn5Feedback = require("./educator/turn5-feedback");
const turn6 = require("./educator/turn6");

// Runtime router가 lifecycle module의 내부 구성을 알지 않도록 이 entrypoint에서 API를 고정한다.
module.exports = {
  condition: "educator",
  persona: educatorPersona,
  buildTurn0Greeting: turn0.buildTurn0Greeting,
  buildIntroMessages: intro.buildIntroMessages,
  getTurn4Question: intro.getTurn4Question,
  buildTurn5EvaluationMessages: turn5Evaluation.buildTurn5EvaluationMessages,
  buildTurn5Feedback: turn5Feedback.buildTurn5Feedback,
  buildTurn6Feedback: turn6.buildTurn6Feedback,
  getPrimaryJobType: turn0.getPrimaryJobType,
  getTurn0WorkText: turn0.getTurn0WorkText,
  addObjectParticle: turn0.addObjectParticle,
  buildEducatorPersonaContext: intro.buildEducatorPersonaContext,
  buildEducatorIntroSafetyCaseContext: intro.buildEducatorIntroSafetyCaseContext,
  buildEducatorIntroSystemPrompt: intro.buildEducatorIntroSystemPrompt,
  buildEducatorIntroUserPrompt: intro.buildEducatorIntroUserPrompt,
  buildEducatorTurn5EvaluationSystemPrompt:
    turn5Evaluation.buildEducatorTurn5EvaluationSystemPrompt,
  buildEducatorTurn5EvaluationUserPrompt:
    turn5Evaluation.buildEducatorTurn5EvaluationUserPrompt,
  normalizeTurn5Evaluation: turn5Evaluation.normalizeTurn5Evaluation,
  formatSafetyRules: formatting.formatSafetyRules,
  formatSafetyRulesForEvaluation: formatting.formatSafetyRulesForEvaluation,
  cleanText: formatting.cleanText,
  joinSafe: formatting.joinSafe
};
