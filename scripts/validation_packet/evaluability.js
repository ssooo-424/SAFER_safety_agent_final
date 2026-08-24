function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function deidentifyCase(item) {
  return {
    major_process: cleanText(item.majorProcess),
    provided_detail_process: cleanText(item.detailProcess) || null,
    position: cleanText(item.position),
    job_types: item.jobType || [],
    triggers: item.triggers || [],
    consequence: cleanText(item.consequence),
    feeling: cleanText(item.feeling),
    low_reasons: item.lowReason || [],
    extra_comment: cleanText(item.extraComment)
  };
}

function inferReferenceDetail(testCase, allowedDetails) {
  const provided = cleanText(testCase.detailProcess);
  if (provided && allowedDetails.includes(provided)) return provided;
  if (allowedDetails.length === 1) return allowedDetails[0];
  const text = [
    testCase.position,
    ...(testCase.jobType || []),
    testCase.consequence,
    testCase.extraComment
  ].join(" ");
  const rules = {
    "골조공사": [
      ["철근·철골 작업", /철근|철골|용접공|데크플레이트/],
      ["콘크리트", /콘크리트|타설|펌프카|호퍼/],
      ["거푸집 작업", /거푸집|형틀|동바리|갱폼/]
    ],
    "마감공사": [
      ["미장/견출 작업", /미장|견출|면갈이/],
      ["도장 작업", /도장|페인트|도료|도장공/],
      ["방수 작업", /방수|우레탄|도막/],
      ["조적 작업", /조적|벽돌|블록/],
      ["마감공사", /마감|내장|창호|잡철물/]
    ]
  };
  const matched = (rules[testCase.majorProcess] || []).find(
    ([detail, pattern]) => allowedDetails.includes(detail) && pattern.test(text)
  );
  if (matched) return matched[0];
  if (
    testCase.majorProcess === "마감공사" &&
    allowedDetails.includes("마감공사")
  ) {
    return "마감공사";
  }
  return null;
}

function classifyScenarioMatchEvaluability(testCase, allowedDetails) {
  const consequence = cleanText(testCase.consequence);
  const hasConcreteMechanism =
    /추락|떨어|낙하|끼|협착|충돌|부딪|화상|화재|감전|넘어|미끄러|매몰|붕괴|무너|베|절상|절단|흡입|호흡기|질식|익사/.test(
      consequence
    );
  const referenceDetail = inferReferenceDetail(testCase, allowedDetails);
  const evaluable = hasConcreteMechanism && Boolean(referenceDetail);
  // 구체 accident mechanism이나 판정 가능한 detail process가 없으면 평가 왜곡을 막기 위해 제외한다.
  return {
    scenario_match_evaluable: evaluable,
    evaluability_rule: !hasConcreteMechanism
      ? "excluded_no_concrete_accident_or_mechanism_in_expected_result"
      : !referenceDetail
        ? "excluded_detail_process_not_resolvable_from_input"
        : "concrete_mechanism_and_detail_process_resolvable",
    reference_detail_process: referenceDetail
  };
}

module.exports = { cleanText, classifyScenarioMatchEvaluability, deidentifyCase };
