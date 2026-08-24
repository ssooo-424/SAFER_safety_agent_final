// 기존 caller가 같은 CommonJS API를 계속 사용하도록 내부 분할을 숨긴다.
const {
  buildScenarioBasedSafetyRulesFromPayload,
  getScenarioMeasures
} = require("./safety_rules/service");
const { buildScenarioBasedSafetyRules } = require("./safety_rules/ruleSelection");
const {
  buildScenarioRulesForReport,
  buildScenarioRulesBubbles,
  formatScenarioRulesForPrompt
} = require("./safety_rules/presentation");
const { normalizeRiskType } = require("./safety_rules/normalization");
const { classifyRuleCategory } = require("./safety_rules/classification");

module.exports = {
  buildScenarioBasedSafetyRulesFromPayload,
  buildScenarioBasedSafetyRules,
  buildScenarioRulesForReport,
  buildScenarioRulesBubbles,
  formatScenarioRulesForPrompt,
  getScenarioMeasures,
  normalizeRiskType,
  classifyRuleCategory
};
