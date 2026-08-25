const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getRelationshipNarrative,
  normalizeRelationship
} = require("../llm/relationshipNarratives");

test("relationship narratives use the selected relation and fall back to family", () => {
  assert.equal(
    getRelationshipNarrative("딸").coworker,
    "사고 뒤 치료가 길어지면서 딸과 예전처럼 시간을 보내거나 잘 놀아주기 어려웠어."
  );
  assert.equal(normalizeRelationship("아들"), "아들");
  assert.equal(normalizeRelationship("지민이 7살"), "가족");
});
