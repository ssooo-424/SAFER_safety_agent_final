const assert = require("node:assert/strict");
const test = require("node:test");

const {
  STANDARDIZED_ORGANIZATIONAL_OUTCOME,
  buildStandardizedOrganizationalOutcomeMessages
} = require("../llm/standardizedOrganizationalOutcome");

test("all personas receive the same standardized organizational outcome facts", () => {
  assert.equal(STANDARDIZED_ORGANIZATIONAL_OUTCOME.source, "standardized_experimental");
  assert.equal(STANDARDIZED_ORGANIZATIONAL_OUTCOME.workStopDuration, "3일");
  assert.equal(STANDARDIZED_ORGANIZATIONAL_OUTCOME.scheduleDelay, "3일");
  assert.equal(STANDARDIZED_ORGANIZATIONAL_OUTCOME.interviewedPeople, 6);

  for (const condition of ["educator", "coworker", "future_self"]) {
    const text = buildStandardizedOrganizationalOutcomeMessages(condition).join("\n");
    assert.match(text, /3일/);
    assert.match(text, /6명/);
    assert.match(text, /작업계획서/);
    assert.match(text, /위험성평가서/);
    assert.match(text, /안전교육 기록/);
    assert.match(text, /작업 전 점검 기록/);
    assert.match(text, /지방고용노동관서/);
    assert.match(text, /경찰/);
    assert.match(text, /안전시설/);
    assert.match(text, /작업방법/);
  }
});

test("organizational outcome uses past results instead of possibility wording", () => {
  for (const condition of ["educator", "coworker", "future_self"]) {
    const text = buildStandardizedOrganizationalOutcomeMessages(condition).join("\n");
    assert.doesNotMatch(text, /수 있습니다|수 있어|수 있었/);
  }
});
