const assert = require("node:assert/strict");
const test = require("node:test");

const rulesEngine = require("../llm/safetyRulesEngine");
const scenarios = require("../reference_data/scenarios.json");

test("scenario matching keeps the exact three-rule research contract", () => {
  const scenario = scenarios["마감공사"]["마감공사"][0];
  const result = rulesEngine.buildScenarioBasedSafetyRulesFromPayload({
    profile: { profileCode: "P-001" },
    incident: {
      scenarioRowId: 2,
      sentence: scenario.scenario,
      majorProcess: scenario.majorProcess,
      detailProcess: scenario.detailProcess,
      processContent: scenario.processContent,
      riskType: scenario.canonicalPrimaryAccident,
      triggers: ["시간 압박"]
    }
  });

  assert.equal(result.rules.length, 3);
  assert.equal(result.source, "scenario_measure_first");
  assert.equal(result.measuresCount, 5);
  assert.equal(new Set(result.rules.map(rule => rule.action)).size, 3);
  assert.equal(new Set(result.rules.map(rule => rule.order)).size, 3);
  assert.ok(result.rules.every(rule => (
    Number.isInteger(rule.order)
    && rule.order > 0
    && typeof rule.action === "string"
    && rule.action.length > 0
    && typeof rule.category === "string"
    && rule.source === "scenario_measure"
  )));

  const report = rulesEngine.buildScenarioRulesForReport(result.rules);
  const bubbles = rulesEngine.buildScenarioRulesBubbles(result.rules);
  const prompt = rulesEngine.formatScenarioRulesForPrompt(result.rules);

  assert.equal(typeof report, "string");
  assert.equal(bubbles.split(" ||| ").length, 6);
  assert.equal(typeof prompt, "string");
  assert.equal(rulesEngine.normalizeRiskType("떨어짐 사고"), "추락");
  assert.equal(rulesEngine.classifyRuleCategory("안전대를 착용하고 부착설비에 체결한다"), "PPE");
});
