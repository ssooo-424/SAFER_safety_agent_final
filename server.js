const express = require("express");
const path = require("path");
const { OpenAI } = require("openai");
const { createExperimentStore } = require("./lib/experimentStore");
const { createConcurrencyGate, createFixedWindowLimiter } = require("./lib/requestLimits");
const { buildScenarioBasedSafetyRulesFromPayload } = require("./llm/safetyRulesEngine");
const { buildSafetyCase } = require("./llm/safetyCaseBuilder");
const prompts = require("./llm/saferPrompts");
const { loadRuntimeConfig } = require("./runtime/config");
const { registerHealthRetiredRoutes } = require("./runtime/healthRetiredRoutes");
const { registerPageRoutes } = require("./runtime/pageRoutes");
const { registerParticipantRoutes } = require("./runtime/participantRoutes");
const { normalizeRiskType } = require("./runtime/riskTypes");
const { registerSaferRoutes } = require("./runtime/saferRoutes");
const { createSafetyCaseService } = require("./runtime/safetyCaseService");
const { createScenarioCatalog } = require("./runtime/scenarioCatalog");
const { registerScenarioRoutes } = require("./runtime/scenarioRoutes");
const { createSessionRequests } = require("./runtime/sessionRequests");
const { registerTtsRoutes } = require("./runtime/ttsRoutes");
const { createGoogleSheetsAutoSync } = require("./runtime/googleSheetsAutoSync");

require("dotenv").config();

const config = loadRuntimeConfig();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  timeout: config.openAiTimeoutMs,
  maxRetries: config.openAiMaxRetries
});
const store = createExperimentStore({ requestLeaseMs: config.requestLeaseMs });
const ready = store.bootstrap();
const catalog = createScenarioCatalog({ rootDir: __dirname, normalizeRiskType });
const buildSafetyCaseFromPayload = createSafetyCaseService({
  catalog,
  buildScenarioRules: buildScenarioBasedSafetyRulesFromPayload,
  buildSafetyCase
});
const sessionRequests = createSessionRequests({
  store,
  submitRateLimiter: createFixedWindowLimiter({
    windowMs: config.fieldRateLimitWindowMs,
    maxPerKey: config.submitRateLimitMaxPerIp,
    maxGlobal: config.submitRateLimitMaxGlobal
  }),
  llmRateLimiter: createFixedWindowLimiter({
    windowMs: config.fieldRateLimitWindowMs,
    maxPerKey: config.llmRateLimitMaxPerIp,
    maxGlobal: config.llmRateLimitMaxGlobal
  }),
  llmConcurrencyGate: createConcurrencyGate({ maxActive: config.llmConcurrencyMax })
});
const googleSheetsSync = createGoogleSheetsAutoSync({ store });

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(async (req, res, next) => {
  try {
    await ready;
    next();
  } catch (error) {
    res.status(503).json({ ok: false, error: "experiment store unavailable" });
  }
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "data_generated", "extracted_images")));

registerPageRoutes(app, __dirname);
registerScenarioRoutes(app, catalog);
registerParticipantRoutes(app, {
  store,
  sessionRequests,
  googleSheetsSync,
  dataRoot: process.env.SAFER_DATA_DIR || null
});
registerSaferRoutes(app, {
  store,
  openai,
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  sessionRequests,
  buildSafetyCaseFromPayload,
  prompts,
  googleSheetsSync
});
registerTtsRoutes(app, {
  openai,
  sessionRequests,
  model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"
});
registerHealthRetiredRoutes(app, { store, config, env: process.env });

if (require.main === module) {
  ready
    .then(() => {
      app.listen(config.port, () => {
        console.log(`Server running: http://localhost:${config.port}`);
      });
    })
    .catch(error => {
      console.error("Experiment store bootstrap failed:", error);
      process.exitCode = 1;
    });
}

module.exports = {
  app,
  store,
  ready,
  close: () => store.close(),
  buildSafetyCaseFromPayload,
  normalizeRiskType
};
