// library load와 payload adapter를 이 boundary에 묶어 import-time 동작을 유지한다.
const { loadMeasureLibrary } = require("./libraryLoader");
const { buildScenarioBasedSafetyRules } = require("./ruleSelection");
const { getScenarioMeasures: matchScenarioMeasures } = require("./scenarioMatcher");

const MEASURE_LIBRARY = loadMeasureLibrary();

function getScenarioMeasures(incident = {}) {
  return matchScenarioMeasures(MEASURE_LIBRARY, incident);
}

function buildScenarioBasedSafetyRulesFromPayload(payload = {}) {
  const profile = payload.profile || payload.userInfo || {};
  const incident = payload.incident || {};
  const measures = getScenarioMeasures(incident);
  const result = buildScenarioBasedSafetyRules({
    measures,
    riskType: incident.riskType || "",
    triggers: incident.triggers || [],
    profileCode: profile.profileCode || ""
  });
  return { ...result, measures };
}

module.exports = { buildScenarioBasedSafetyRulesFromPayload, getScenarioMeasures };
