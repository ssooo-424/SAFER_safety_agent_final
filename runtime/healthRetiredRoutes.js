const LEGACY_POST_ROUTES = [
  "/api/submit-followup",
  "/api/save-chat",
  "/api/generate",
  "/api/chat",
  "/api/context"
];

function registerHealthRetiredRoutes(app, { store, config, env }) {
  for (const route of LEGACY_POST_ROUTES) {
    app.post(route, (req, res) => res.status(410).json({ ok: false, error: "legacy endpoint disabled" }));
  }

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      store: { kind: store.durable ? "postgres" : "memory", durable: store.durable },
      assignmentMode: env.FIXED_CONDITION ? "fixed" : "balanced",
      credentials: {
        openai: Boolean(env.OPENAI_API_KEY),
        database: Boolean(env.DATABASE_URL)
      },
      timing: {
        openaiTimeoutMs: config.openAiTimeoutMs,
        openaiMaxRetries: config.openAiMaxRetries,
        requestLeaseMs: config.requestLeaseMs
      },
      limits: {
        windowMs: config.fieldRateLimitWindowMs,
        submitPerIp: config.submitRateLimitMaxPerIp,
        submitGlobal: config.submitRateLimitMaxGlobal,
        llmPerIp: config.llmRateLimitMaxPerIp,
        llmGlobal: config.llmRateLimitMaxGlobal,
        llmConcurrency: config.llmConcurrencyMax
      }
    });
  });

  app.get("/api/last-survey", (req, res) => {
    return res.status(410).json({ ok: false, error: "last survey lookup is disabled" });
  });
}

module.exports = { registerHealthRetiredRoutes };
