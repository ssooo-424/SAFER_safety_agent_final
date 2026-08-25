const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

test("pre-survey omits the separately administered risk-perception page", () => {
  const html = fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8");
  const form = fs.readFileSync(path.join(rootDir, "public", "pre-survey", "form.js"), "utf8");
  const state = fs.readFileSync(path.join(rootDir, "public", "pre-survey", "state.js"), "utf8");
  const app = fs.readFileSync(path.join(rootDir, "public", "app.js"), "utf8");

  assert.doesNotMatch(html, /위험지각 인식확인|id="q13"|id="q14"|id="q15"/);
  assert.doesNotMatch(form, /q13|q14|q15|attitude/);
  assert.match(html, /Step 1 \/ 4/);
  assert.match(state, /totalSteps:\s*4/);
  assert.match(app, /step === 3[^\n]*loadScenarios/);
});
