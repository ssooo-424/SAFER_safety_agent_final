const { Pool } = require('pg');

const { assertCondition } = require('./conditionAssignment');
const {
  beginRequest,
  completeRequest,
  failRequest,
} = require('./postgres/requestPersistence');
const { bootstrapSchema } = require('./postgres/schemaBootstrap');
const {
  createSession,
  getSession,
  updateSession,
} = require('./postgres/sessionPersistence');

const DEFAULT_REQUEST_LEASE_MS = 120_000;

// public API를 이 facade에 고정해 persistence module 분리가 caller에 노출되지 않게 한다.
class PostgresExperimentStore {
  constructor({
    connectionString,
    fixedCondition,
    random = Math.random,
    requestLeaseMs = DEFAULT_REQUEST_LEASE_MS,
    now = () => new Date(),
    pool,
  } = {}) {
    if (fixedCondition !== undefined) {
      assertCondition(fixedCondition);
    }
    this.durable = true;
    this.fixedCondition = fixedCondition;
    this.random = random;
    this.requestLeaseMs = requestLeaseMs;
    this.now = now;
    this.ownsPool = !pool;
    this.pool = pool || new Pool({ connectionString });
  }

  async bootstrap() {
    await bootstrapSchema(this.pool);
    return this;
  }

  async createSession({ submissionKey, data } = {}) {
    return createSession(
      this.pool,
      { fixedCondition: this.fixedCondition, random: this.random },
      { submissionKey, data },
    );
  }

  async getSession(sessionId) {
    return getSession(this.pool, sessionId);
  }

  async close() {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  async updateSession(sessionId, { condition, data = {} } = {}) {
    return updateSession(this.pool, sessionId, { condition, data });
  }

  async beginRequest(sessionId, request) {
    return beginRequest(
      this.pool,
      { requestLeaseMs: this.requestLeaseMs, now: this.now },
      sessionId,
      request,
    );
  }

  async completeRequest(sessionId, { requestId, leaseGeneration, response, sessionData } = {}) {
    return completeRequest(this.pool, sessionId, {
      requestId,
      leaseGeneration,
      response,
      sessionData,
    });
  }

  async failRequest(sessionId, { requestId, leaseGeneration } = {}) {
    return failRequest(this.pool, sessionId, { requestId, leaseGeneration });
  }
}

module.exports = { PostgresExperimentStore };
