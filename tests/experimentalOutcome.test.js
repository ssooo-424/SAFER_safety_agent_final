const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  STANDARD_SEVERE_INJURY_OUTCOME,
  buildExperimentalScenarioView,
  containsFatalOutcome,
  getExperimentalOutcomeForSafetyCase,
  ensureExperimentalInjuryText,
  sanitizeGeneratedOutcomeText
} = require("../llm/experimentalOutcome");
const saferPrompts = require("../llm/saferPrompts");

const rootDir = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(rootDir, "reference_data", "scenarios.json"), "utf8"));
const scenarios = Object.values(source).flatMap(details => Object.values(details).flat());
const fatalIds = ["25", "82", "106", "183", "185", "192"];

function safetyCaseFor(row) {
  const view = buildExperimentalScenarioView(row);
  return {
    scenario: { scenario_id: String(row.id), risk_type: row.primaryAccident || "", triggers: [] },
    actual_case: {
      case_id: `index-scenario-${row.id}`,
      risk_type: row.canonicalPrimaryAccident || row.primaryAccident || "",
      summary: view.scenario,
      raw_text: `${view.hazard || ""}\n${view.scenario || ""}`
    },
    safety_rules: []
  };
}

test("fatal source scenarios remain unchanged and participant views remove fatal expressions", () => {
  for (const id of fatalIds) {
    const row = scenarios.find(item => String(item.id) === id);
    assert.ok(row, `scenario ${id} exists`);
    const before = JSON.stringify(row);
    const view = buildExperimentalScenarioView(row);
    assert.equal(view.outcomeAdapted, true);
    assert.equal(containsFatalOutcome(view.scenario, view.hazard), false);
    assert.match(view.scenario, new RegExp(STANDARD_SEVERE_INJURY_OUTCOME));
    assert.equal(JSON.stringify(row), before);
  }
});

test("all personas receive the same adapted physical injury for every fatal scenario", () => {
  for (const id of fatalIds) {
    const row = scenarios.find(item => String(item.id) === id);
    const safetyCase = safetyCaseFor(row);
    const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
    assert.equal(policy.outcomeAdapted, true);
    for (const condition of ["educator", "coworker", "future_self"]) {
      const messages = saferPrompts.buildSaferIntroMessages({
        condition,
        safetyCase,
        participantContext: { profile: { importantPerson: "가족" }, incident: {} }
      });
      const content = messages.map(message => message.content).join("\n");
      assert.ok(content.includes(policy.injury.part), `${condition} ${id} includes common injury part`);
      assert.ok(content.includes(policy.injury.symptom), `${condition} ${id} includes common injury symptom`);
    }
  }
});

test("fatal LLM wording is replaced before a participant response is returned", () => {
  const result = sanitizeGeneratedOutcomeText("작업자가 사망했다. 이후 현장은 중단됐다.", { outcomeAdapted: true });
  assert.equal(containsFatalOutcome(result), false);
  assert.ok(result.includes(STANDARD_SEVERE_INJURY_OUTCOME));
});

test("missing physical-injury detail is added consistently to an adapted outcome", () => {
  const row = scenarios.find(item => String(item.id) === "25");
  const safetyCase = safetyCaseFor(row);
  const text = ensureExperimentalInjuryText("사고로 크게 다쳤다.", safetyCase);
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  assert.ok(text.includes(policy.commonOutcome));
  assert.ok(text.includes(policy.injury.part));
  assert.ok(text.includes(policy.injury.symptom));
});

test("all personas receive concrete shared injury details for a nonfatal scenario", () => {
  const row = scenarios.find(item => !fatalIds.includes(String(item.id)) && item.primaryAccident);
  const safetyCase = safetyCaseFor(row);
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  assert.equal(policy.outcomeAdapted, false);

  for (const condition of ["educator", "coworker", "future_self"]) {
    const messages = saferPrompts.buildSaferIntroMessages({
      condition,
      safetyCase,
      participantContext: {
        profile: { importantPerson: "가족" },
        incident: { consequence: "프롬프트에 들어가면 안 되는 참가자 예상 피해" }
      }
    });
    const prompt = messages.map(message => message.content).join("\n");
    assert.ok(prompt.includes(policy.injury.part));
    assert.ok(prompt.includes(policy.injury.symptom));
    assert.doesNotMatch(prompt, /프롬프트에 들어가면 안 되는 참가자 예상 피해/);

    const output = ensureExperimentalInjuryText("심각한 부상을 입었다.", safetyCase, condition);
    assert.ok(output.includes(policy.injury.part));
    assert.ok(output.includes(policy.injury.symptom));
    assert.match(output, condition === "educator" ? /작업자는/ : /나는/);
  }
});

test("pre-survey no longer renders or submits the anticipated-consequence question", () => {
  const html = fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8");
  const form = fs.readFileSync(path.join(rootDir, "public", "pre-survey", "form.js"), "utf8");
  assert.doesNotMatch(html, /id="consequence"/);
  assert.doesNotMatch(html, /이 사고가 실제로 발생한다면, 어떤 결과/);
  assert.doesNotMatch(form, /getElementById\("consequence"\)/);
});

test("a concrete source injury takes priority over the risk-type fallback", () => {
  const row = scenarios.find(item => String(item.id) === "37");
  const safetyCase = safetyCaseFor(row);
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  assert.equal(policy.injurySource, "source");
  assert.match(policy.sourceInjuryText, /손가락이 절단된다/);

  for (const condition of ["educator", "coworker", "future_self"]) {
    const prompt = saferPrompts.buildSaferIntroMessages({
      condition,
      safetyCase,
      participantContext: { profile: { importantPerson: "가족" }, incident: {} }
    }).map(message => message.content).join("\n");
    assert.match(prompt, /손가락이 절단된다/);
    assert.doesNotMatch(prompt, /손가락 절단과 신경 손상으로 감각을 잃은 상태/);

    const output = ensureExperimentalInjuryText("심각한 부상을 입었다.", safetyCase, condition);
    assert.match(output, /손가락이 절단된다/);
    if (condition !== "educator") assert.match(output, /내가/);
  }
});

test("a generic source injury uses the standardized risk-type fallback", () => {
  const safetyCase = {
    scenario: { scenario_id: "generic", risk_type: "깔림", triggers: [] },
    actual_case: {
      case_id: "index-scenario-generic",
      risk_type: "깔림",
      summary: "작업자가 구조물과 충돌하여 심각한 부상을 입는다.",
      raw_text: "작업자가 구조물과 충돌하여 심각한 부상을 입는다."
    },
    safety_rules: []
  };
  const policy = getExperimentalOutcomeForSafetyCase(safetyCase);
  assert.equal(policy.injurySource, "standardized_fallback");
  assert.equal(policy.injury.part, "갈비뼈와 장기");
  const output = ensureExperimentalInjuryText("심각한 부상을 입었다.", safetyCase, "educator");
  assert.match(output, /갈비뼈와 장기/);
  assert.match(output, /복합 골절과 장기 손상으로 만성 통증/);
});

test("a naturally conjugated puncture injury is not followed by a duplicated raw source sentence", () => {
  const row = scenarios.find(item => String(item.id) === "92");
  const safetyCase = safetyCaseFor(row);
  const generated = "결국 손가락이 파일의 날카로운 끝에 찔려서 다쳤어.";
  const output = ensureExperimentalInjuryText(generated, safetyCase, "coworker");

  assert.equal(output, generated);
  assert.doesNotMatch(output, /구체적으로 내가 겪은 피해/);
  assert.doesNotMatch(output, /손가락이 찔린다/);
});
