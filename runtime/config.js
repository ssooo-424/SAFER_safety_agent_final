function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function loadRuntimeConfig(env = process.env) {
  const openAiTimeoutMs = boundedInteger(env.OPENAI_TIMEOUT_MS, 30000, 1, 120000);
  const openAiMaxRetries = boundedInteger(env.OPENAI_MAX_RETRIES, 0, 0, 5);
  const fieldRateLimitWindowMs = boundedInteger(
    env.FIELD_RATE_LIMIT_WINDOW_MS,
    600000,
    1000,
    3600000
  );
  const submitRateLimitMaxPerIp = boundedInteger(
    env.SUBMIT_RATE_LIMIT_MAX_PER_IP,
    30,
    1,
    10000
  );
  const submitRateLimitMaxGlobal = boundedInteger(
    env.SUBMIT_RATE_LIMIT_MAX_GLOBAL,
    120,
    submitRateLimitMaxPerIp,
    50000
  );
  const llmRateLimitMaxPerIp = boundedInteger(
    env.LLM_RATE_LIMIT_MAX_PER_IP,
    60,
    1,
    10000
  );
  const llmRateLimitMaxGlobal = boundedInteger(
    env.LLM_RATE_LIMIT_MAX_GLOBAL,
    240,
    llmRateLimitMaxPerIp,
    50000
  );
  const llmConcurrencyMax = boundedInteger(env.LLM_CONCURRENCY_MAX, 12, 1, 100);
  const minimumRequestLeaseMs = Math.max(
    120000,
    openAiTimeoutMs * (openAiMaxRetries + 1) + 30000
  );
  const requestLeaseMs = env.REQUEST_LEASE_MS === undefined
    ? minimumRequestLeaseMs
    : Number(env.REQUEST_LEASE_MS);

  if (!Number.isInteger(requestLeaseMs) || requestLeaseMs < minimumRequestLeaseMs) {
    throw new Error(`REQUEST_LEASE_MS must be an integer of at least ${minimumRequestLeaseMs}`);
  }

  return {
    port: env.PORT || 3001,
    openAiTimeoutMs,
    openAiMaxRetries,
    fieldRateLimitWindowMs,
    submitRateLimitMaxPerIp,
    submitRateLimitMaxGlobal,
    llmRateLimitMaxPerIp,
    llmRateLimitMaxGlobal,
    llmConcurrencyMax,
    requestLeaseMs
  };
}

module.exports = { loadRuntimeConfig };
