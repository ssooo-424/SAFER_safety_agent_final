function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildCaseText(testCase = {}) {
  return [
    testCase.position,
    ...(testCase.jobType || []),
    ...(testCase.triggers || []),
    testCase.consequence,
    testCase.feeling,
    testCase.extraComment
  ].map(cleanText).filter(Boolean).join(" ");
}

const DETAIL_RULES = {
  "골조공사": [
    { detail: "철근·철골 작업", pattern: /철근|철골|용접공|데크플레이트/ },
    { detail: "콘크리트", pattern: /콘크리트|타설|펌프카|호퍼/ },
    { detail: "거푸집 작업", pattern: /거푸집|형틀|동바리|갱폼/ }
  ],
  "마감공사": [
    { detail: "미장/견출 작업", pattern: /미장|견출|면갈이/ },
    { detail: "도장 작업", pattern: /도장|페인트|도료|도장공/ },
    { detail: "방수 작업", pattern: /방수|우레탄|도막/ },
    { detail: "조적 작업", pattern: /조적|벽돌|블록/ },
    { detail: "마감공사", pattern: /마감|내장|창호|잡철물/ }
  ]
};

function resolveDetailProcess({ testCase, detailsByMajor }) {
  const major = cleanText(testCase.majorProcess);
  const details = detailsByMajor.get(major) || [];
  const provided = cleanText(testCase.expectedDetailProcess || testCase.detailProcess);

  if (provided && details.includes(provided)) {
    return {
      detail: provided,
      source: testCase.expectedDetailProcess ? "human_expected_detail" : "provided_detail",
      confidence: "confirmed"
    };
  }
  if (details.length === 1) {
    return { detail: details[0], source: "single_detail_for_major", confidence: "high" };
  }

  const text = buildCaseText(testCase);
  const matched = (DETAIL_RULES[major] || []).find(rule => rule.pattern.test(text));
  if (matched) {
    return { detail: matched.detail, source: "keyword_suggestion", confidence: "medium" };
  }
  if (major === "마감공사" && details.includes("마감공사")) {
    return { detail: "마감공사", source: "generic_major_fallback", confidence: "low" };
  }
  return { detail: "", source: "unresolved", confidence: "none" };
}

function selectCurrentCandidates(candidates = []) {
  const selected = [];
  const seenAccidents = new Set();

  for (const item of candidates) {
    if (selected.length >= 3) break;
    const accident = item.primaryAccident || "기타";
    if (!seenAccidents.has(accident)) {
      selected.push(item);
      seenAccidents.add(accident);
    }
  }
  if (selected.length < 3) {
    for (const item of candidates) {
      if (selected.length >= 3) break;
      if (!selected.some(selectedItem => selectedItem.id === item.id)) selected.push(item);
    }
  }
  return selected;
}

function buildCandidateResult(item) {
  return {
    scenario_id: item.id,
    process_content: item.processContent,
    primary_risk_type: item.canonicalPrimaryAccident || item.primaryAccident,
    all_risk_types: item.canonicalAccidents || item.accidents || [],
    scenario: item.scenario
  };
}

module.exports = {
  buildCandidateResult,
  buildCaseText,
  cleanText,
  resolveDetailProcess,
  selectCurrentCandidates
};
