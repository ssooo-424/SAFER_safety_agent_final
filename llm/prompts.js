require("./safetyRulesEngine");

const { buildC2Prompt } = require("./prompts/reportPrompt");
const { buildC3System } = require("./prompts/chatPrompt");
const { buildChoiceContextPrompt } = require("./prompts/choicePrompt");
const {
  generateSafetyRules,
  triggersToCodes,
  TRIGGER_TO_CODE,
  TRIGGER_KOSHA_ACTIONS
} = require("./prompts/safetyRuleSelection");
const {
  buildRulesBubbles,
  buildRulesForReport
} = require("./prompts/rulePresentation");

module.exports = {
  buildC2Prompt,
  buildC3System,
  buildChoiceContextPrompt,
  generateSafetyRules,
  buildRulesBubbles,
  buildRulesForReport,
  triggersToCodes,
  TRIGGER_TO_CODE,
  TRIGGER_KOSHA_ACTIONS
};
