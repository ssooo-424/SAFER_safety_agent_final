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
  assert.match(html, /id="preRiskR1"[^>]*data-touched="false"/);
  assert.match(html, /id="preRiskR2"[^>]*data-touched="false"/);
  assert.match(html, /id="preRiskR3"[^>]*data-touched="false"/);
  assert.match(html, /<option value="없음">없음 — 검사 결과 없음<\/option>/);
  assert.match(form, /slider\.dataset\.touched !== "true"/);
  assert.match(form, /사고 위험지각 세 문항의 응답 바를 모두 한 번씩 움직여주세요/);
  assert.match(form, /riskPerception:\s*\{[\s\S]*?R1:[\s\S]*?R2:[\s\S]*?R3:/);
  assert.match(html, /Step 1 \/ 5/);
  assert.match(state, /totalSteps:\s*5/);
  assert.match(app, /step === 4[^\n]*loadScenarios/);
});
