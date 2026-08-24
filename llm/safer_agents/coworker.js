// 공개 API를 유지하면서 구현을 lifecycle별 module에 위임한다.
const coworkerPersona = require("../safer_personas/coworker.json");
const {
  cleanText,
  joinSafe,
  formatSafetyRules,
  formatSafetyRulesForEvaluation
} = require("./coworker/shared");
const {
  buildTurn0Greeting,
  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle
} = require("./coworker/turn0");
const { buildCoworkerPersonaContext } = require("./coworker/personaContext");
const {
  buildIntroMessages,
  buildCoworkerIntroSafetyCaseContext,
  buildCoworkerIntroSystemPrompt,
  buildCoworkerIntroUserPrompt
} = require("./coworker/intro");
const {
  buildTurn5EvaluationMessages,
  buildCoworkerTurn5EvaluationSystemPrompt,
  buildCoworkerTurn5EvaluationUserPrompt,
  normalizeTurn5Evaluation
} = require("./coworker/turn5Evaluation");
const { buildTurn5Feedback } = require("./coworker/turn5Feedback");
const { buildTurn6Feedback } = require("./coworker/turn6");

function getTurn4Question() {
  return (
    coworkerPersona.turns?.["4"]?.question_template ||
    "그럼 이런 사고를 막으려면 작업 전에 우리가 뭘 확인해야 할 것 같아? 생각나는 걸 편하게 말해줘."
  );
}

module.exports = {
  condition: "coworker",
  persona: coworkerPersona,
  buildTurn0Greeting,
  buildIntroMessages,
  getTurn4Question,
  buildTurn5EvaluationMessages,
  buildTurn5Feedback,
  buildTurn6Feedback,
  getPrimaryJobType,
  getTurn0WorkText,
  addObjectParticle,
  buildCoworkerPersonaContext,
  buildCoworkerIntroSafetyCaseContext,
  buildCoworkerIntroSystemPrompt,
  buildCoworkerIntroUserPrompt,
  buildCoworkerTurn5EvaluationSystemPrompt,
  buildCoworkerTurn5EvaluationUserPrompt,
  normalizeTurn5Evaluation,
  formatSafetyRules,
  formatSafetyRulesForEvaluation,
  cleanText,
  joinSafe
};
