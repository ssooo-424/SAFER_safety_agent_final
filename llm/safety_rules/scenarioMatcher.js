// 첫 성공 stage만 사용해야 기존 matching precedence와 log 시점이 유지된다.
const { extractMeasuresFromEntry } = require("./measureExtraction");
const {
  matchExactSentence,
  matchPartialSentence,
  matchVerifiedRowId,
  matchProcess
} = require("./matcherStages");

function buildCriteria(incident) {
  return {
    rowId: String(incident.scenarioRowId ?? "").trim(),
    sentence: String(incident.sentence || "").trim(),
    major: String(incident.majorProcess || "").trim(),
    detail: String(incident.detailProcess || "").trim(),
    processContent: String(incident.processContent || "").trim(),
    riskType: String(incident.riskType || "").trim()
  };
}

function findMatchedEntries(library, criteria) {
  let matched = matchExactSentence(library, criteria.sentence);
  if (matched.length > 0) {
    console.log(`✅ [안전수칙 매칭] sentence 정확 매칭 (${matched.length}건)`);
    return matched;
  }

  matched = matchPartialSentence(library, criteria.sentence);
  if (matched.length > 0) {
    console.log(`✅ [안전수칙 매칭] sentence 부분 매칭 (${matched.length}건)`);
    return matched;
  }

  matched = matchVerifiedRowId(library, criteria);
  if (matched.length > 0) {
    console.log(`✅ [안전수칙 매칭] rowId + 공정검증 (${matched.length}건)`);
    return matched;
  }

  matched = matchProcess(library, criteria);
  if (matched.length > 0) {
    console.log(`✅ [안전수칙 매칭] 공정/작업/위험유형 매칭 (${matched.length}건)`);
  }
  return matched;
}

function getScenarioMeasures(library, incident = {}) {
  if (!library || library.length === 0) return [];
  const matched = findMatchedEntries(library, buildCriteria(incident));
  if (matched.length === 0) {
    console.warn("⚠️ [안전수칙 매칭] 해당 시나리오의 감소대책을 찾지 못함 → fallback 사용");
    return [];
  }

  for (const entry of matched) {
    const measures = extractMeasuresFromEntry(entry);
    if (measures.length > 0) return measures;
  }

  console.warn("⚠️ [안전수칙 매칭] Entry는 찾았지만 감소대책 문장이 없음 → fallback 사용");
  return [];
}

module.exports = { getScenarioMeasures };
