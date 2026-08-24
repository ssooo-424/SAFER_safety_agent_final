const { randomUUID } = require('node:crypto');

const {
  CONDITIONS,
  assertCondition,
  chooseBalancedCondition,
} = require('./conditionAssignment');
const {
  assertRequestOrder,
  clone,
  nextPhase,
  normalizeData,
  validateRequestInput,
} = require('./memory/sessionState');
const {
  assertLeaseGeneration,
  currentTime,
  isStale,
} = require('./memory/requestLease');

const DEFAULT_REQUEST_LEASE_MS = 120_000;

class MemoryExperimentStore {
  constructor({
    fixedCondition,
    random = Math.random,
    requestLeaseMs = DEFAULT_REQUEST_LEASE_MS,
    now = () => new Date(),
  } = {}) {
    if (fixedCondition !== undefined) {
      assertCondition(fixedCondition);
    }
    this.durable = false;
    this.fixedCondition = fixedCondition;
    this.random = random;
    this.requestLeaseMs = requestLeaseMs;
    this.now = now;
    this.sessions = new Map();
    this.submissionKeys = new Map();
    this.requests = new Map();
    this.queue = Promise.resolve();
  }

  async bootstrap() {
    return this;
  }

  async close() {}

  async createSession({ submissionKey, data } = {}) {
    return this.#serialize(() => {
      if (submissionKey && this.submissionKeys.has(submissionKey)) {
        return clone(this.sessions.get(this.submissionKeys.get(submissionKey)));
      }

      const counts = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));
      for (const session of this.sessions.values()) {
        counts[session.condition] += 1;
      }
      const condition = this.fixedCondition || chooseBalancedCondition(counts, this.random);
      const session = {
        sessionId: randomUUID(),
        participantId: randomUUID(),
        condition,
        assignmentMode: this.fixedCondition ? 'fixed' : 'balanced',
        data: normalizeData(data),
        phase: 'created',
        nextTurn: 4,
        createdAt: new Date().toISOString(),
      };

      this.sessions.set(session.sessionId, session);
      if (submissionKey) {
        this.submissionKeys.set(submissionKey, session.sessionId);
      }
      return clone(session);
    });
  }

  async getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? clone(session) : null;
  }

  async updateSession(sessionId, { condition, data = {} } = {}) {
    if (condition !== undefined) {
      throw new Error('condition is immutable');
    }
    return this.#serialize(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('unknown session');
      }
      session.data = { ...session.data, ...normalizeData(data) };
      return clone(session);
    });
  }

  async beginRequest(sessionId, request) {
    validateRequestInput(request);
    return this.#serialize(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('unknown session');
      }
      const requestKey = `${sessionId}:${request.requestId}`;
      const existing = this.requests.get(requestKey);
      if (existing && (existing.operation !== request.operation || existing.turn !== request.turn)) {
        throw new Error('requestId cannot be reused for another operation');
      }
      if (existing?.status === 'completed') {
        return clone({ ...existing, status: 'completed' });
      }
      if (existing?.status === 'started') {
        if (isStale(existing, { requestLeaseMs: this.requestLeaseMs, now: this.now })) {
          existing.startedAt = currentTime(this.now).toISOString();
          existing.leaseGeneration += 1;
          return clone(existing);
        }
        return clone({ ...existing, status: 'pending' });
      }
      if (
        [...this.requests.values()].some(
          (storedRequest) =>
            storedRequest.sessionId === sessionId && storedRequest.status === 'started',
        )
      ) {
        throw new Error('a request is already pending');
      }
      assertRequestOrder(session, request);
      const started = {
        sessionId,
        requestId: request.requestId,
        operation: request.operation,
        turn: request.turn,
        status: 'started',
        leaseGeneration: existing ? existing.leaseGeneration + 1 : 1,
        startedAt: currentTime(this.now).toISOString(),
      };
      this.requests.set(requestKey, started);
      return clone(started);
    });
  }

  async completeRequest(sessionId, { requestId, leaseGeneration, response, sessionData } = {}) {
    return this.#serialize(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('unknown session');
      }
      const request = this.requests.get(`${sessionId}:${requestId}`);
      if (!request) {
        throw new Error('unknown request');
      }
      if (request.status === 'completed') {
        return clone(request);
      }
      if (request.status !== 'started') {
        throw new Error('request is not pending');
      }
      assertLeaseGeneration(request, leaseGeneration);
      const dataPatch = normalizeData(sessionData);
      request.status = 'completed';
      request.response = clone(response ?? null);
      session.data = { ...session.data, ...dataPatch };
      Object.assign(session, nextPhase(request));
      return clone(request);
    });
  }

  async failRequest(sessionId, { requestId, leaseGeneration } = {}) {
    return this.#serialize(() => {
      const request = this.requests.get(`${sessionId}:${requestId}`);
      if (!request) {
        throw new Error('unknown request');
      }
      if (request.status === 'completed') {
        return clone(request);
      }
      if (request.status === 'started') {
        assertLeaseGeneration(request, leaseGeneration);
      }
      request.status = 'failed';
      return clone(request);
    });
  }

  #serialize(work) {
    // 동시 mutation의 처리 순서를 보장하려면 serialization이 필요하다.
    const current = this.queue.then(work, work);
    this.queue = current.catch(() => undefined);
    return current;
  }
}

module.exports = {
  MemoryExperimentStore,
};
