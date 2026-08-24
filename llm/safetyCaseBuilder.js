function buildImagePath(pairFileName) {
  if (
    !pairFileName ||
    !/\.(pdf|hwp)$/i.test(
      pairFileName
    )
  ) {
    return null;
  }

  const imageName = pairFileName
    .replace(".pdf", ".jpg")
    .replace(".hwp", ".jpg");

  return `/images/${imageName}`;
}

function buildSafetyCase({
  scenarioId,
  payload,
  selectedCase,
  rules = []
}) {
  const incident = payload?.incident || {};

  // 후속 prompt와 평가가 같은 구조를 소비하므로 기본 필드를 유지하고 safety_rules는 최대 3개로 제한한다.
  return {
    scenario: {
      scenario_id: scenarioId,
      major_process: incident.majorProcess || "",
      detail_process: incident.detailProcess || "",
      process_content: incident.processContent || "",
      risk_type: incident.riskType || "",
      triggers: incident.triggers || []
    },

    actual_case: {
      case_id: selectedCase?.fileName || "",
      is_real_case: selectedCase?.isRealCase !== false,
      match_level: selectedCase?.matchMeta?.level || "",
      match_process_group: selectedCase?.matchMeta?.processGroup || "",
      shared_hazards: selectedCase?.matchMeta?.sharedHazards || [],
      process: selectedCase?.process || "",
      process_groups: selectedCase?.processGroups || [],
      risk_type:
        selectedCase?.canonicalRiskType ||
        selectedCase?.riskType || "",
      source_risk_type: selectedCase?.riskType || "",
      hazard_objects: selectedCase?.hazardObjects || [],
      mechanism_type: selectedCase?.mechanismType || "",
      mechanism: selectedCase?.mechanism || "",
      trigger: selectedCase?.trigger || "",
      hazard: selectedCase?.hazard || selectedCase?.trigger || "",
      accidents: selectedCase?.accidents || [],
      canonical_accidents: selectedCase?.canonicalAccidents || [],
      risk_likelihood: selectedCase?.riskLikelihood || "",
      risk_severity: selectedCase?.riskSeverity || "",
      risk_level: selectedCase?.riskLevel || "",
      measures: selectedCase?.measures || "",
      legal_basis: selectedCase?.legalBasis || "",
      summary: selectedCase?.summary || "",
      raw_text: selectedCase?.textContent || "",
      source_file: selectedCase?.pairFileName || "",
      image_path: buildImagePath(selectedCase?.pairFileName)
    },

    safety_rules: rules.slice(0, 3).map((rule, index) => ({
      rule_id: index + 1,
      action: rule?.action || "",
      comment: rule?.comment || ""
    }))
  };
}

module.exports = {
  buildSafetyCase
};
