// row ID 불일치 사례 때문에 sentence 우선의 4단계 matching 순서를 유지한다.
const {
  getEntryRowId,
  getEntryScenarioText,
  getEntryMajor,
  getEntryDetail,
  getEntryProcessContent,
  getEntryRiskType
} = require("./entryAdapter");
const { normalizeRiskType, normalizeText } = require("./normalization");

function matchExactSentence(library, sentence) {
  if (!sentence) return [];
  const target = normalizeText(sentence);
  return library.filter(entry => {
    const src = normalizeText(getEntryScenarioText(entry));
    return src && src === target;
  });
}

function matchPartialSentence(library, sentence) {
  if (!sentence) return [];
  const target = normalizeText(sentence);
  return library.filter(entry => {
    const src = normalizeText(getEntryScenarioText(entry));
    return src && (src.includes(target) || target.includes(src));
  });
}

function sameOptionalValue(target, source) {
  return !target || !source || source === target;
}

function sameOptionalRisk(target, source) {
  return !target || !source || normalizeRiskType(source) === normalizeRiskType(target);
}

function matchVerifiedRowId(library, criteria) {
  if (!criteria.rowId) return [];
  return library.filter(entry => {
    const entryRowId = String(getEntryRowId(entry)).trim();
    if (entryRowId !== criteria.rowId) return false;
    const entryMajor = String(getEntryMajor(entry) || "").trim();
    const entryDetail = String(getEntryDetail(entry) || "").trim();
    const entryRisk = String(getEntryRiskType(entry) || "").trim();
    return sameOptionalValue(criteria.major, entryMajor) &&
      sameOptionalValue(criteria.detail, entryDetail) &&
      sameOptionalRisk(criteria.riskType, entryRisk);
  });
}

function matchProcess(library, criteria) {
  if (!criteria.major && !criteria.detail && !criteria.processContent) return [];
  return library.filter(entry => {
    const entryMajor = String(getEntryMajor(entry) || "").trim();
    const entryDetail = String(getEntryDetail(entry) || "").trim();
    const entryProcessContent = String(getEntryProcessContent(entry) || "").trim();
    const entryRisk = String(getEntryRiskType(entry) || "").trim();
    return sameOptionalValue(criteria.major, entryMajor) &&
      sameOptionalValue(criteria.detail, entryDetail) &&
      sameOptionalValue(criteria.processContent, entryProcessContent) &&
      sameOptionalRisk(criteria.riskType, entryRisk);
  });
}

module.exports = { matchExactSentence, matchPartialSentence, matchVerifiedRowId, matchProcess };
