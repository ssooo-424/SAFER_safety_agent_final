// 서로 다른 library schema를 matcher 안으로 누출하지 않도록 field alias를 모은다.
function getEntryRowId(entry = {}) {
  return entry.scenarioRowId ?? entry.rowId ?? entry.rowID ?? entry.originalRowNo ??
    entry.originalRowNumber ?? entry.originalIndex ?? entry["원본행번호"] ??
    entry["시나리오행ID"] ?? entry.id ?? entry.scenarioId ?? "";
}

function getEntryScenarioText(entry = {}) {
  return entry.scenario ?? entry.sentence ?? entry.scenarioText ?? entry.riskScenario ??
    entry["위험시나리오"] ?? entry["유해위험요인"] ?? "";
}

function getEntryMajor(entry = {}) {
  return entry.majorProcess ?? entry["대공정"] ?? "";
}

function getEntryDetail(entry = {}) {
  return entry.detailProcess ?? entry["세부공정"] ?? "";
}

function getEntryProcessContent(entry = {}) {
  return entry.processContent ?? entry.workContent ?? entry["작업내용"] ?? "";
}

function getEntryRiskType(entry = {}) {
  return entry.riskType ?? entry.primaryAccident ?? entry["사고분류"] ?? "";
}

module.exports = {
  getEntryRowId,
  getEntryScenarioText,
  getEntryMajor,
  getEntryDetail,
  getEntryProcessContent,
  getEntryRiskType
};
