// accident와 trigger 우선순위 뒤 category 다양성을 적용해 기존 선택 순서를 보존한다.
const { toWorkerAction } = require("./actionNormalization");
const { accidentPriority, classifyRuleCategory, getTriggerCode, triggerPriority } = require("./classification");
const { fallbackRules } = require("./fallbackRules");
const { normalizeText } = require("./normalization");
const { buildRuleComment } = require("./presentation");

function prepareRules(measures, riskType, triggerCode) {
  return (measures || []).map((measure, idx) => {
    const workerAction = toWorkerAction(measure.action);
    const category = classifyRuleCategory(workerAction);
    return {
      action: workerAction,
      comment: buildRuleComment(workerAction, triggerCode, category),
      category,
      source: "scenario_measure",
      order: measure.order || idx + 1,
      accidentPriority: accidentPriority(workerAction, riskType),
      triggerPriority: triggerPriority(workerAction, triggerCode)
    };
  }).filter(rule => rule.action);
}

function compareRules(a, b) {
  if (a.accidentPriority !== b.accidentPriority) return a.accidentPriority - b.accidentPriority;
  if (a.triggerPriority !== b.triggerPriority) return a.triggerPriority - b.triggerPriority;
  return a.order - b.order;
}

function hasSameAction(selected, rule) {
  return selected.find(item => normalizeText(item.action) === normalizeText(rule.action));
}

function selectRules(sorted, riskType, triggers, profileCode) {
  const selected = [];
  const usedCategories = new Set();
  for (const rule of sorted) {
    if (selected.length >= 3) break;
    if (!usedCategories.has(rule.category)) {
      selected.push(rule);
      usedCategories.add(rule.category);
    }
  }
  for (const rule of sorted) {
    if (selected.length >= 3) break;
    if (!hasSameAction(selected, rule)) selected.push(rule);
  }
  if (selected.length < 3) {
    for (const rule of fallbackRules({ riskType, triggers, profileCode })) {
      if (selected.length >= 3) break;
      if (!hasSameAction(selected, rule)) selected.push(rule);
    }
  }
  return selected;
}

function buildScenarioBasedSafetyRules({ measures, riskType, triggers, profileCode }) {
  const prepared = prepareRules(measures, riskType, getTriggerCode(triggers));
  return {
    source: prepared.length > 0 ? "scenario_measure_first" : "fallback_only",
    measuresCount: measures?.length || 0,
    rules: selectRules(prepared.sort(compareRules), riskType, triggers, profileCode).slice(0, 3)
  };
}

module.exports = { buildScenarioBasedSafetyRules };
