const outcomeOverrides = require("../reference_data/scenario_outcome_overrides.json");

const STANDARD_SEVERE_INJURY_OUTCOME =
  "사고로 크게 다쳐 장기간 치료와 재활이 필요했고, 이전처럼 일상생활과 현장 업무를 이어가기 어려운 상태가 되었다.";

const STANDARDIZED_INJURY_SCENARIOS = {
  "추락": { part: "척추와 하반신", symptom: "하반신 마비로 휠체어에 의지해 생활하는 상태" },
  "떨어짐": { part: "척추와 하반신", symptom: "하반신 마비로 휠체어에 의지해 생활하는 상태" },
  "협착·끼임": { part: "손가락과 신경", symptom: "손가락 절단과 신경 손상으로 감각을 잃은 상태" },
  "끼임": { part: "손가락과 신경", symptom: "손가락 절단과 신경 손상으로 감각을 잃은 상태" },
  "깔림": { part: "갈비뼈와 장기", symptom: "복합 골절과 장기 손상으로 만성 통증을 겪는 상태" },
  "낙하·비래": { part: "머리와 어깨", symptom: "뇌진탕 후유증과 만성 두통 및 어지럼증을 겪는 상태" },
  "충돌·접촉": { part: "무릎과 골반", symptom: "복합 골절로 보행에 어려움을 겪는 상태" },
  "충돌 및 접촉": { part: "무릎과 골반", symptom: "복합 골절로 보행에 어려움을 겪는 상태" },
  "넘어짐": { part: "무릎과 손목", symptom: "관절 손상으로 작업 능력이 크게 떨어진 상태" },
  "감전·화재": { part: "피부와 신경", symptom: "심각한 화상 흉터와 신경병성 통증을 겪는 상태" },
  "감전": { part: "심장과 신경", symptom: "심장 부정맥과 신경 손상으로 감각 이상을 겪는 상태" },
  "화상": { part: "피부", symptom: "심각한 화상 흉터와 만성 통증을 겪는 상태" },
  "붕괴·전도": { part: "전신", symptom: "복합 부상으로 장기간 입원과 재활을 이어가는 상태" },
  "절상(절단,찔림,베임)": { part: "손과 팔", symptom: "신경과 힘줄 손상으로 손가락 움직임이 제한된 상태" },
  "절상": { part: "손과 팔", symptom: "신경과 힘줄 손상으로 손가락 움직임이 제한된 상태" },
  "질식": { part: "호흡기와 뇌", symptom: "저산소증 후유증으로 인지 기능이 저하된 상태" },
  "질병": { part: "호흡기와 근골격계", symptom: "만성 직업병으로 일상생활에 큰 제약을 겪는 상태" },
  default: { part: "허리와 다리", symptom: "만성 통증과 거동 불편으로 이전처럼 일하기 어려운 상태" }
};

const FATAL_OUTCOME_PATTERN = /사망|사망자|숨졌|숨짐|숨지|목숨을\s*잃|사망에\s*이르/;
const CONCRETE_INJURY_PATTERN = /(골절|절단(?:된다|되어|됨|됐다|부상)|절상(?:된다|부상|을)|화상(?:을|으로)|손상(?:된다|되어|을|이)|출혈|타박상|마비|실명|시각\s*장애|청각[^.!?]*손상|호흡기\s*질병|중독|의식을\s*잃|현기증|메스꺼움|만성[^.!?]*통증|찔린|찔리|찔려|베이|질식(?:하|\s*상태|으로))/;
const cleanText = value => String(value || "").trim();

function getStandardizedInjuryScenario(riskType = "") { return STANDARDIZED_INJURY_SCENARIOS[cleanText(riskType)] || STANDARDIZED_INJURY_SCENARIOS.default; }
function getScenarioOutcomeOverride(scenarioId) { return outcomeOverrides[cleanText(scenarioId)] || null; }
function containsFatalOutcome(...values) { return values.flat(Infinity).map(cleanText).filter(Boolean).some(value => FATAL_OUTCOME_PATTERN.test(value)); }
function classifyScenarioOutcome(scenario = {}) {
  const override = getScenarioOutcomeOverride(scenario.id);
  if (override?.sourceOutcomeType === "fatal") return { sourceOutcomeType: "fatal", reviewStatus: override.reviewStatus || "confirmed" };
  return { sourceOutcomeType: containsFatalOutcome(scenario.scenario, scenario.hazard) ? "fatal" : "nonfatal_or_unspecified" };
}
function splitSentences(text = "") { return cleanText(text).split(/(?<=[.!?])\s+|\n+/).map(cleanText).filter(Boolean); }
function extractSourceInjuryText(safetyCase = {}) {
  const actualCase = safetyCase.actual_case || {};
  const sentences = splitSentences([actualCase.summary, actualCase.raw_text].filter(Boolean).join("\n"));
  const concrete = [];
  for (const sentence of sentences) {
    const normalized = sentence.replace(/^(유해위험요인|사고 시나리오)\s*:\s*/i, "").trim();
    if (!normalized || containsFatalOutcome(normalized) || !CONCRETE_INJURY_PATTERN.test(normalized)) continue;
    if (!concrete.includes(normalized)) concrete.push(normalized);
    if (concrete.length >= 2) break;
  }
  return concrete.join(" ");
}
function toFirstPersonInjuryText(text = "") {
  return cleanText(text)
    .replace(/작업자의|근로자의|재해자의/g, "나의")
    .replace(/작업자가|근로자가|재해자가/g, "내가")
    .replace(/작업자는|근로자는|재해자는/g, "나는");
}
function adaptFatalScenarioText(sourceText = "") { const retained = splitSentences(sourceText).filter(sentence => !containsFatalOutcome(sentence)); retained.push(STANDARD_SEVERE_INJURY_OUTCOME); return retained.join(" "); }
function adaptFatalHazardText(sourceText = "") { const source = cleanText(sourceText); return !source || containsFatalOutcome(source) ? "사고로 인해 작업자가 중상을 입음" : source; }
function buildExperimentalScenarioView(scenario = {}) {
  const classification = classifyScenarioOutcome(scenario);
  if (classification.sourceOutcomeType !== "fatal") return { ...scenario, outcomeAdapted: false };
  return { ...scenario, scenario: adaptFatalScenarioText(scenario.scenario), hazard: adaptFatalHazardText(scenario.hazard), outcomeAdapted: true };
}
function getExperimentalOutcomeForSafetyCase(safetyCase = {}) {
  const caseId = cleanText(safetyCase.actual_case?.case_id);
  const scenarioId = caseId.replace(/^index-scenario-/, "");
  const outcomeAdapted = getScenarioOutcomeOverride(scenarioId)?.sourceOutcomeType === "fatal";
  const riskType = cleanText(safetyCase.actual_case?.risk_type) || cleanText(safetyCase.scenario?.risk_type);
  const sourceInjuryText = outcomeAdapted ? "" : extractSourceInjuryText(safetyCase);
  return {
    outcomeAdapted,
    commonOutcome: outcomeAdapted ? STANDARD_SEVERE_INJURY_OUTCOME : "",
    injury: getStandardizedInjuryScenario(riskType),
    injurySource: sourceInjuryText ? "source" : "standardized_fallback",
    sourceInjuryText
  };
}
function buildExperimentalOutcomePromptContext(safetyCase = {}) {
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  const sharedInjuryRules = policy.injurySource === "source"
    ? [
      "[세 AI 공통 신체 피해 표현 규칙]",
      "원자료에 구체적인 신체 피해가 있으므로 사고유형별 보조 매핑을 사용하지 마세요.",
      `세 AI가 공통으로 사용할 원자료 피해: ${policy.sourceInjuryText}`,
      "Turn 3에서 위 원자료 피해를 구체적으로 포함하고, 관계와 말투만 다르게 표현하세요."
    ]
    : [
    "[세 AI 공통 신체 피해 표현 규칙]",
    "원자료에 구체적인 신체 피해가 없어 사고유형별 공통 매핑을 사용합니다.",
    `사고유형에 따른 공통 손상 부위는 '${policy.injury.part}'입니다.`,
    `공통 후유 상태는 '${policy.injury.symptom}'입니다.`,
    "Turn 3에서 '심각한 부상'이라고만 끝내지 말고 위 손상 부위와 후유 상태를 구체적으로 포함하세요.",
    "세 AI는 동일한 신체 피해 사실을 사용하고, 관계와 말투만 다르게 표현하세요."
  ];
  if (!policy.outcomeAdapted) return sharedInjuryRules.join("\n");
  return [
    ...sharedInjuryRules,
    "[참가자용 사망 결과 변환 규칙]",
    "이 사고의 원자료상 사망 결과는 내부적으로만 보존됩니다.",
    `참가자에게는 반드시 다음 공통 결과만 사용하세요: ${policy.commonOutcome}`,
    "사망, 사망자, 숨졌다, 목숨을 잃었다 등의 표현을 쓰거나 원자료 결과를 복원하지 마세요.",
    "동료와 미래의 나는 생존하여 치료와 회복 중인 사람으로만 말해야 합니다."
  ].join("\n");
}
function ensureExperimentalInjuryText(text = "", safetyCase = {}, condition = "educator") {
  const source = cleanText(text);
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  const additions = [];
  if (policy.outcomeAdapted) {
    const hasCommonOutcome = source.includes(policy.commonOutcome) || (
      source.includes("장기간 치료와 재활") &&
      source.includes("일상생활") &&
      source.includes("현장 업무")
    );
    if (!hasCommonOutcome) additions.push(policy.commonOutcome);
  }
  if (policy.injurySource === "source" && !CONCRETE_INJURY_PATTERN.test(source)) {
    const evidence = condition === "educator"
      ? policy.sourceInjuryText
      : toFirstPersonInjuryText(policy.sourceInjuryText);
    const lead = condition === "educator"
      ? "원자료에 기록된 구체적인 피해는 다음과 같습니다."
      : "구체적으로 내가 겪은 피해는 이랬어.";
    additions.push(`${lead} ${evidence}`);
  }
  if (policy.injurySource === "standardized_fallback" && (
    !source.includes(policy.injury.part) || !source.includes(policy.injury.symptom)
  )) {
    const subject = condition === "educator" ? "작업자는" : "나는";
    const ending = condition === "educator" ? "되었습니다." : "됐어.";
    additions.push(`구체적으로 ${subject} ${policy.injury.part}에 심각한 손상을 입어 ${policy.injury.symptom}가 ${ending}`);
  }
  return [source, ...additions].filter(Boolean).join(" ");
}
function sanitizeGeneratedOutcomeText(text = "", { outcomeAdapted = false, replacement = STANDARD_SEVERE_INJURY_OUTCOME } = {}) {
  const source = cleanText(text);
  if (!outcomeAdapted || !containsFatalOutcome(source)) return source;
  const retained = []; let replaced = false;
  for (const sentence of splitSentences(source)) { if (!containsFatalOutcome(sentence)) retained.push(sentence); else if (!replaced) { retained.push(replacement); replaced = true; } }
  return retained.join(" ");
}
module.exports = { STANDARD_SEVERE_INJURY_OUTCOME, STANDARDIZED_INJURY_SCENARIOS, FATAL_OUTCOME_PATTERN, CONCRETE_INJURY_PATTERN, getStandardizedInjuryScenario, getScenarioOutcomeOverride, containsFatalOutcome, classifyScenarioOutcome, extractSourceInjuryText, adaptFatalScenarioText, adaptFatalHazardText, buildExperimentalScenarioView, getExperimentalOutcomeForSafetyCase, buildExperimentalOutcomePromptContext, ensureExperimentalInjuryText, sanitizeGeneratedOutcomeText };
