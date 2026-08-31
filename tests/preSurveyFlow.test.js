const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

test("pre-survey requires all three risk-perception sliders before continuing", () => {
  const html = fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8");
  const form = fs.readFileSync(path.join(rootDir, "public", "pre-survey", "form.js"), "utf8");
  const state = fs.readFileSync(path.join(rootDir, "public", "pre-survey", "state.js"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "public", "app.js"), "utf8");

  assert.match(html, /사고 위험지각 \(100점\)/);
  assert.match(html, /id="preRiskR1"[^>]*step="10"[^>]*data-touched="false"/);
  assert.match(html, /id="preRiskR2"[^>]*step="10"[^>]*data-touched="false"/);
  assert.match(html, /id="preRiskR3"[^>]*step="10"[^>]*data-touched="false"/);
  assert.doesNotMatch(html, /안전성향 유형 코드|id="profileCode"|검사 결과 없음/);
  assert.doesNotMatch(form, /profileCode|안전성향 유형 코드를 선택해주세요/);
  for (const ageGroup of ["20대", "30대", "40대", "50대", "60대"]) {
    assert.match(html, new RegExp(`<option value="${ageGroup}">${ageGroup}<\\/option>`));
  }
  assert.match(form, /if \(!document\.getElementById\("ageGroup"\)\.value\) return "연령대를 선택해주세요\."/);
  assert.match(form, /ageGroup:\s*document\.getElementById\("ageGroup"\)\.value/);
  assert.match(form, /slider\.dataset\.touched !== "true"/);
  assert.match(form, /사고 위험지각 세 문항의 응답 바를 모두 한 번씩 움직여주세요/);
  assert.match(form, /riskPerception:\s*\{[\s\S]*?R1:[\s\S]*?R2:[\s\S]*?R3:/);
  assert.match(html, /현재 현장에서 수행하고 계신 작업에 대한 정보를 선택해 주세요\./);
  assert.match(html, /해당하는 작업이 없다면, 본인의 작업과 가장 비슷하거나 위험하다고 생각했던 작업을 선택해 주세요\./);
  assert.match(html, /현장에서 사고가 발생하는 주요 원인이 무엇이라고 생각하시는지 선택해 주세요\./);
  assert.doesNotMatch(html, /data-group="lowReason"|산업현장에서 사고가 많이 발생하는 주요 원인이 무엇이라고 생각하시나요\? \(2개\)/);
  assert.doesNotMatch(form, /lowReason:\s*getChecked\("lowReason"\)/);
  assert.match(html, /왜 이러한 저해 요인이 발생한다고 생각하시나요\? \(선택\)[\s\S]*?id="extraComment"/);
  assert.match(html, /Step 1 \/ 5/);
  assert.match(state, /totalSteps:\s*5/);
  assert.match(app, /step === 4[^\n]*loadScenarios/);
});
