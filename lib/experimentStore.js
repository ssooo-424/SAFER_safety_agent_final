const { MemoryExperimentStore } = require('./memoryExperimentStore');
const { PostgresExperimentStore } = require('./postgresExperimentStore');

function parseRequestLeaseMs(value) {
  if (value === undefined) {
    return undefined;
  }
  const requestLeaseMs = Number(value);
  if (!Number.isFinite(requestLeaseMs) || requestLeaseMs <= 0) {
    throw new Error('REQUEST_LEASE_MS must be a positive number');
  }
  return requestLeaseMs;
}

function createExperimentStore({
  env = process.env,
  pool,
  random,
  now,
  requestLeaseMs,
} = {}) {
  const fixedCondition = env.FIXED_CONDITION || undefined;
  const configuredRequestLeaseMs = parseRequestLeaseMs(
    requestLeaseMs === undefined ? env.REQUEST_LEASE_MS : requestLeaseMs,
  );
  // DATABASE_URL은 영구 Postgres를, 미설정은 메모리 저장소를 선택해 배포와 로컬 실행을 구분한다.
  if (env.DATABASE_URL) {
    return new PostgresExperimentStore({
      connectionString: env.DATABASE_URL,
      fixedCondition,
      pool,
      random,
      now,
      requestLeaseMs: configuredRequestLeaseMs,
    });
  }
  return new MemoryExperimentStore({
    fixedCondition,
    random,
    now,
    requestLeaseMs: configuredRequestLeaseMs,
  });
}

module.exports = {
  createExperimentStore,
  parseRequestLeaseMs,
};
