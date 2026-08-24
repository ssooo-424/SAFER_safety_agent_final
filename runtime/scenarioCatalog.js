const fs = require("fs");
const path = require("path");

function createScenarioCatalog({ rootDir, normalizeRiskType }) {
  const scenarioPath = path.join(rootDir, "reference_data", "scenarios.json");
  let scenarioPool = {};
  const scenariosById = new Map();

  try {
    scenarioPool = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
    for (const details of Object.values(scenarioPool)) {
      for (const items of Object.values(details)) {
        for (const item of items) {
          const key = String(item.id);
          if (scenariosById.has(key)) throw new Error(`중복 scenarioRowId: ${key}`);
          scenariosById.set(key, item);
        }
      }
    }
    console.log(`✅ 시나리오 풀 로드 완료: ${scenariosById.size}개`);
  } catch (error) {
    scenarioPool = {};
    scenariosById.clear();
    console.warn("⚠️ scenarios.json 로드 실패:", error.message);
    console.warn("   먼저 scripts/scenario_to_json.py를 실행해주세요.");
  }

  function selectForParticipant(major, detail) {
    const candidates = scenarioPool[major]?.[detail] || [];
    const selected = [];
    const seenAccidents = new Set();

    for (const item of candidates) {
      if (selected.length >= 3) break;
      const accident = item.primaryAccident || "기타";
      if (seenAccidents.has(accident)) continue;
      selected.push(item);
      seenAccidents.add(accident);
    }

    for (const item of candidates) {
      if (selected.length >= 3) break;
      if (!selected.some(selectedItem => selectedItem.id === item.id)) selected.push(item);
    }
    return selected;
  }

  function getSelectedScenario(incident = {}) {
    const rowId = incident.scenarioRowId;
    if (rowId !== null && rowId !== undefined && String(rowId).trim() !== "") {
      // scenarioRowId가 원자료 행의 identity이므로 Turn 전체에서 같은 사례를 고정한다.
      const selected = scenariosById.get(String(rowId));
      if (selected) return selected;
    }

    const sentence = String(incident.sentence || "").trim();
    if (!sentence) return null;
    for (const item of scenariosById.values()) {
      if (String(item.scenario || "").trim() === sentence) return item;
    }
    return null;
  }

  function buildSelectedScenarioCase(incident = {}) {
    const selected = getSelectedScenario(incident);
    if (!selected) return null;
    const rowId = String(selected.id);
    return {
      fileName: `index-scenario-${rowId}`,
      pairFileName: "risk_assessment_with_scenarios.xlsx",
      process: selected.processContent || selected.detailProcess || selected.majorProcess || "",
      processGroups: [selected.majorProcess, selected.detailProcess].filter(Boolean),
      riskType: selected.primaryAccident || "",
      canonicalRiskType: selected.canonicalPrimaryAccident || normalizeRiskType(selected.primaryAccident),
      accidents: selected.accidents || [],
      canonicalAccidents: selected.canonicalAccidents || [],
      trigger: selected.hazard || "",
      hazard: selected.hazard || "",
      measures: selected.measures || "",
      riskLikelihood: selected.riskLikelihood || "",
      riskSeverity: selected.riskSeverity || "",
      riskLevel: selected.riskLevel || "",
      legalBasis: selected.legalBasis || "",
      summary: selected.scenario || "",
      textContent: [
        selected.hazard ? `유해위험요인: ${selected.hazard}` : "",
        selected.scenario ? `사고 시나리오: ${selected.scenario}` : ""
      ].filter(Boolean).join("\n"),
      isRealCase: true,
      reviewStatus: selected.classificationReview?.status || "source_classification",
      reviewNote: selected.classificationReview?.reason || "",
      matchMeta: {
        level: "selected_scenario",
        reason: "selected_index_scenario_row",
        riskType: selected.canonicalPrimaryAccident || selected.primaryAccident || "",
        processGroup: selected.detailProcess || selected.majorProcess || "",
        processSource: "scenarioRowId",
        sharedHazards: [],
        score: 100
      }
    };
  }

  return { scenarioPool, selectForParticipant, buildSelectedScenarioCase };
}

module.exports = { createScenarioCatalog };
