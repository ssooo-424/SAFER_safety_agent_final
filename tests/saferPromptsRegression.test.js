const assert = require("node:assert/strict");
const test = require("node:test");

const saferPrompts = require("../llm/saferPrompts");
const { stripRepeatedCoworkerExperience } = require("../runtime/saferRoutes");

const safetyCase = {
  scenario: {
    scenario_id: "A-T1T2",
    major_process: "가설공사",
    detail_process: "안전가시설",
    process_content: "작업발판 설치 작업",
    risk_type: "추락",
    triggers: ["시간 압박"]
  },
  actual_case: {
    case_id: "sample-case",
    process: "작업발판 점검",
    risk_type: "추락",
    trigger: "안전난간 미설치",
    summary: "작업 중 개구부로 추락",
    raw_text: "작업자가 작업 중 개구부로 추락하여 사망하였다."
  },
  safety_rules: [
    { rule_id: 1, action: "작업 시작 전 작업발판의 고정 상태를 확인한다.", comment: "" },
    { rule_id: 2, action: "안전대를 착용하고 안전대 부착설비에 체결한다.", comment: "" },
    { rule_id: 3, action: "개구부에 덮개 또는 안전난간을 설치한다.", comment: "" }
  ]
};

const participantContext = {
  profile: {
    importantPerson: "배우자"
  },
  incident: {
    triggers: ["시간 압박"],
    feeling: "빨리 끝내고 쉬고 싶어서",
  }
};

const evaluation = {
  coverage: safetyCase.safety_rules.map((rule, index) => ({
    rule_id: rule.rule_id,
    status: index === 1 ? "covered" : "not_covered",
    acknowledgement: index === 1 ? "안전대를 착용하고 체결하는 것" : "",
    summary: rule.action,
    evidence: index === 1 ? "안전대를 착용" : ""
  }))
};

for (const condition of ["educator", "coworker", "future_self"]) {
  test(`${condition} agent exposes the Turn 0-6 runtime contract`, () => {
    const agent = saferPrompts.getSaferAgent(condition);
    const turn0 = saferPrompts.buildSaferTurn0Greeting({
      condition,
      profile: {
        name: "김철수",
        jobType: ["기능공(직접 작업)"],
        importantPerson: "가족"
      },
      safetyCase
    });
    const intro = saferPrompts.buildSaferIntroMessages({ condition, safetyCase, participantContext });
    const turn4 = saferPrompts.getSaferTurn4Question({ condition, safetyCase, participantContext });
    const evaluationMessages = saferPrompts.buildSaferTurn5EvaluationMessages({
      condition,
      safetyCase,
      userMessage: "안전대를 착용해야 해."
    });
    const feedback = saferPrompts.buildSaferTurn5Feedback({
      condition,
      safetyCase,
      userMessage: "안전대를 착용해야 해.",
      participantContext,
      evaluation
    });
    const turn6 = saferPrompts.buildSaferTurn6Feedback({ condition, safetyCase });

    assert.equal(agent.condition, condition);
    assert.equal(typeof turn0.assistant, "string");
    assert.deepEqual(intro.map(message => message.role), ["system", "user"]);
    assert.ok(intro.every(message => typeof message.content === "string" && message.content.length > 0));
    assert.equal(typeof turn4, "string");
    assert.deepEqual(evaluationMessages.map(message => message.role), ["system", "user"]);
    assert.deepEqual(feedback.coveredRuleIds, [2]);
    assert.deepEqual(feedback.missingRuleIds, [1, 3]);
    assert.equal(typeof feedback.assistant, "string");
    assert.deepEqual(
      turn6.safetyRules,
      safetyCase.safety_rules.map(({ rule_id, action }) => ({ rule_id, action })),
    );
    assert.equal(typeof turn6.assistant, "string");
  });
}

test("unknown condition is rejected at the router boundary", () => {
  assert.throws(() => saferPrompts.getSaferAgent("unknown"));
});

test("coworker introduces the peer relationship before beginning the firsthand accident account", () => {
  const greeting = saferPrompts.buildSaferTurn0Greeting({
    condition: "coworker",
    profile: { name: "김철수" },
    safetyCase
  });
  const intro = saferPrompts.buildSaferIntroMessages({
    condition: "coworker",
    safetyCase,
    participantContext
  });

  assert.match(greeting.assistant, /나는 너랑 같은 현장에서 근무하던 작업자야\./);
  assert.match(greeting.assistant, /오늘 안전가시설 작업한다고 들었어\./);
  assert.doesNotMatch(greeting.assistant, /실제로 사고가 났어|자세히 말해줄게/);
  assert.match(intro[1].content, /나도 같은 종류의 작업을 하다가 실제로 사고를 겪었어\./);
  assert.match(intro[1].content, /Turn 1-A에서 이미 별도로 제공/);
  assert.match(intro[1].content, /생성하는 Turn 1-B에는 사용하지 마세요/);
  assert.match(intro[1].content, /사고 원인은 무엇이었나요\?/);
  assert.match(intro[1].content, /사고로 어떤 피해가 발생했나요\?/);
});

test("coworker Turn 1 removes the fixed peer-experience sentence if the LLM repeats it", () => {
  const fixedExperience = "나도 같은 종류의 작업을 하다가 실제로 사고를 겪었어.";
  const generated = [
    "그날은 안전가시설 작업을 위해 비계를 설치하고 있었어.",
    fixedExperience
  ].join(" ");

  assert.equal(
    stripRepeatedCoworkerExperience(generated, fixedExperience),
    "그날은 안전가시설 작업을 위해 비계를 설치하고 있었어."
  );
});
