function createSafetyCaseService({ catalog, buildScenarioRules, buildSafetyCase }) {
  return function buildSafetyCaseFromPayload({ payload, scenarioId }) {
    if (!payload) throw new Error("payload required");
    if (!scenarioId) throw new Error("scenarioId required");

    const selectedCase = catalog.buildSelectedScenarioCase(payload.incident || {});
    if (!selectedCase) {
      return { selectedCase: null, scenarioRulesResult: null, safetyCase: null };
    }

    const scenarioRulesResult = buildScenarioRules(payload);
    const safetyCase = buildSafetyCase({
      scenarioId,
      payload,
      selectedCase,
      rules: scenarioRulesResult.rules
    });
    return { selectedCase, scenarioRulesResult, safetyCase };
  };
}

module.exports = { createSafetyCaseService };
