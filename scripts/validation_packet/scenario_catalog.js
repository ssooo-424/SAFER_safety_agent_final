function compactScenario(item) {
  return {
    scenario_id: item.id,
    major_process: item.majorProcess,
    detail_process: item.detailProcess,
    process_content: item.processContent,
    primary_risk_type: item.canonicalPrimaryAccident || item.primaryAccident,
    all_risk_types: item.canonicalAccidents || item.accidents || [],
    hazard: item.hazard || "",
    scenario: item.scenario || "",
    safety_measures: item.measures || ""
  };
}

function flattenScenarioPool(pool) {
  const rows = [];
  for (const details of Object.values(pool)) {
    for (const scenarios of Object.values(details)) {
      for (const item of scenarios) rows.push(compactScenario(item));
    }
  }
  return rows.sort(
    (left, right) => Number(left.scenario_id) - Number(right.scenario_id)
  );
}

function modelCaseMap(result) {
  return new Map((result.cases || []).map(item => [item.case_id, item]));
}

function unique(values) {
  return [...new Set(values)];
}

module.exports = { compactScenario, flattenScenarioPool, modelCaseMap, unique };
