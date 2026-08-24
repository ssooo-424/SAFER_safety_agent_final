const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const apiClientPath = path.join(publicDir, "api-client.js");

function loadApiClient() {
  delete require.cache[require.resolve(apiClientPath)];
  return require(apiClientPath);
}

test("Given a participant POST, when the caller supplies a request ID, then the client sends that exact ID once with JSON", async () => {
  assert.equal(fs.existsSync(apiClientPath), true, "api-client.js must provide the participant request boundary");

  const { createApiClient } = loadApiClient();
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true, saved: true }), {
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.postJson("/api/submit", { answer: "확인" }, "submit-once");

  assert.deepEqual(result, { ok: true, saved: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/submit");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Request-Id"], "submit-once");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.body, JSON.stringify({ answer: "확인" }));
});

test("Given a request that exceeds its configured timeout, when the fetch is aborted, then the client reports a retryable timeout once", async () => {
  assert.equal(fs.existsSync(apiClientPath), true, "api-client.js must provide timeout handling");

  const { createApiClient, ApiClientError } = loadApiClient();
  let calls = 0;
  const client = createApiClient({
    timeoutMs: 1,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      calls += 1;
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });

  await assert.rejects(
    () => client.postJson("/api/safer-start", {}, "start-timeout"),
    (error) => error instanceof ApiClientError && error.kind === "timeout" && error.retryable === true,
  );
  assert.equal(calls, 1);
});

test("Given a network failure, when a participant POST is sent, then the client does not automatically retry", async () => {
  assert.equal(fs.existsSync(apiClientPath), true, "api-client.js must provide network error handling");

  const { createApiClient, ApiClientError } = loadApiClient();
  let calls = 0;
  const client = createApiClient({
    fetchImpl: async () => {
      calls += 1;
      throw new Error("offline");
    },
  });

  await assert.rejects(
    () => client.postJson("/api/safer-chat", { turn: 4 }, "chat-network"),
    (error) => error instanceof ApiClientError && error.kind === "network" && error.retryable === true,
  );
  assert.equal(calls, 1);
});

test("Given a field rate limit response, when a participant POST is rejected, then the client exposes a retryable 429 without retrying automatically", async () => {
  const { createApiClient, ApiClientError } = loadApiClient();
  let calls = 0;
  const client = createApiClient({
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({
        ok: false,
        error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      }), { status: 429, headers: { "content-type": "application/json" } });
    },
  });

  await assert.rejects(
    () => client.postJson("/api/safer-intro", {}, "intro-rate-limit"),
    (error) => (
      error instanceof ApiClientError
      && error.status === 429
      && error.retryable === true
      && /잠시 후/.test(error.message)
    ),
  );
  assert.equal(calls, 1);
});

test("Given the participant pages, when their request contracts are inspected, then they load the shared client and omit client authority", () => {
  const index = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
  const safer = fs.readFileSync(path.join(publicDir, "safer.js"), "utf8");
  const saferHtml = fs.readFileSync(path.join(publicDir, "safer.html"), "utf8");
  const postSurvey = fs.readFileSync(path.join(publicDir, "post-survey.html"), "utf8");
  const postSurveyScript = fs.readFileSync(path.join(publicDir, "post-survey.js"), "utf8");

  assert.doesNotMatch(index, /loadLastBtn|최근 설문 불러오기/);
  assert.doesNotMatch(app, /\/api\/last-survey|loadLastBtn/);
  assert.match(index, /<script src="api-client\.js"><\/script>\s*<script src="app\.js"><\/script>/);
  assert.match(app, /SaferApi\.createApiClient/);
  assert.match(app, /sessionStorage\.getItem\(SUBMIT_REQUEST_ID_KEY\)/);
  assert.match(app, /sessionStorage\.removeItem\(SUBMIT_REQUEST_ID_KEY\)/);
  assert.match(app, /window\.location\.href = "\/safer"/);
  assert.doesNotMatch(app, /\/next(?:\.html)?/);
  assert.match(saferHtml, /<script src="\/api-client\.js" defer><\/script>\s*<script src="\/voice-client\.js" defer><\/script>\s*<script src="\/safer\.js" defer><\/script>/);
  assert.match(safer, /postJson\(\s*"\/api\/safer-start",\s*\{\}\s*\)/);
  assert.match(safer, /postJson\(\s*"\/api\/safer-intro",\s*\{\}\s*\)/);
  assert.match(safer, /inputMethod/);
  assert.match(safer, /actualCase\.risk_type/);
  assert.match(safer, /actualCase\.trigger/);
  assert.doesNotMatch(safer, /safetyCase:\s*state\.safetyCase|payload:\s*state\.payload|scenarioId:\s*state\.scenarioId/);
  assert.match(postSurvey, /<script src="\/api-client\.js"><\/script>/);
  assert.match(postSurvey, /<script src="\/post-survey\.js"><\/script>/);
  assert.match(postSurveyScript, /SaferApi\.createApiClient/);
  assert.doesNotMatch(postSurveyScript, /participantId:|condition:|scenarioRowId:|name:|org:/);
});

test("Given a pre-survey submission error, when the shared client provides detail, then the participant sees that detail instead of a generic server-only alert", () => {
  const app = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
  const submitCatch = app.match(/async function submitSurvey\(\)[\s\S]*?\} catch\(e\) \{([\s\S]*?)\n    \}/);

  assert.ok(submitCatch, "submitSurvey must retain its error handler");
  assert.match(submitCatch[1], /alert\("제출 실패: " \+ e\.message\)/);
  assert.doesNotMatch(submitCatch[1], /alert\("서버 오류"\)/);
  assert.match(submitCatch[1], /nextBtn\.disabled = false/);
});

test("Given a completed participant flow, when a pre-survey or post-survey succeeds, then prior participant display state is cleared before navigation", () => {
  const app = fs.readFileSync(path.join(publicDir, "app.js"), "utf8");
  const postSurvey = fs.readFileSync(path.join(publicDir, "post-survey.js"), "utf8");
  const preSurveySuccess = app.match(/if \(json\.ok\) \{([\s\S]*?)\n      \} else/);
  const postSurveySuccess = postSurvey.match(/sessionStorage\.removeItem\(POST_SURVEY_REQUEST_ID_KEY\);([\s\S]*?)window\.location\.href = "\/";/);

  assert.ok(preSurveySuccess, "pre-survey success handler must exist");
  assert.ok(postSurveySuccess, "post-survey success handler must exist");
  assert.match(preSurveySuccess[1], /localStorage\.removeItem\("saferAssignedCondition"\)/);
  assert.doesNotMatch(preSurveySuccess[1], /localStorage\.setItem\("saferAssignedCondition"/);
  assert.match(preSurveySuccess[1], /localStorage\.removeItem\("commitSelectedRule"\)/);
  assert.match(preSurveySuccess[1], /localStorage\.removeItem\("commitFinalPhrase"\)/);
  assert.ok(
    preSurveySuccess[1].indexOf('localStorage.removeItem("saferAssignedCondition")')
      < preSurveySuccess[1].indexOf('localStorage.setItem("preSurveyResult"'),
    "old condition must be cleared before the fresh response is stored",
  );
  for (const key of ["preSurveyResult", "saferAssignedCondition", "commitSelectedRule", "commitFinalPhrase"]) {
    assert.match(postSurveySuccess[1], new RegExp(`localStorage\\.removeItem\\("${key}"\\)`));
  }
});
