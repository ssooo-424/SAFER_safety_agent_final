const { randomUUID } = require("crypto");

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createSessionRequests({ store, submitRateLimiter, llmRateLimiter, llmConcurrencyGate }) {
  function getRequestId(req) {
    const value = req.get("X-Request-Id");
    if (value === undefined) return randomUUID();
    const requestId = value.trim();
    if (!REQUEST_ID_PATTERN.test(requestId)) throw new Error("X-Request-Id must be a UUID");
    return requestId.toLowerCase();
  }

  function getSessionId(req) {
    const cookies = String(req.headers.cookie || "").split(";").map(value => value.trim());
    const cookie = cookies.find(value => value.startsWith("safer_session="));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.slice("safer_session=".length));
    } catch {
      return null;
    }
  }

  async function requireSession(req, res) {
    // participant context의 authority는 client payload가 아니라 server session이다.
    const sessionId = getSessionId(req);
    const session = sessionId ? await store.getSession(sessionId) : null;
    if (!session) {
      res.status(401).json({ ok: false, error: "valid SAFER session required" });
      return null;
    }
    return session;
  }

  function requestErrorStatus(error) {
    const message = String(error?.message || error);
    if (message.includes("out of order") || message.includes("already pending") || message.includes("lease generation")) return 409;
    if (message.includes("requestId") || message.includes("Request-Id") || message.includes("turn must")) return 400;
    return 500;
  }

  function errorMetadata(error) {
    return {
      name: typeof error?.name === "string" ? error.name : "Error",
      code: typeof error?.code === "string" ? error.code : undefined,
      status: Number.isInteger(error?.status) ? error.status : undefined
    };
  }

  function publicRequestError(req, res, error) {
    const status = requestErrorStatus(error);
    const message = String(error?.message || error);
    if (status === 400 && message.includes("Request-Id")) return res.status(400).json({ ok: false, error: "X-Request-Id must be a UUID" });
    if (status === 400 && message.includes("requestId")) return res.status(400).json({ ok: false, error: "request ID cannot be reused for another operation" });
    if (status === 400 && message.includes("turn must")) return res.status(400).json({ ok: false, error: "turn must be an integer from 4 to 6" });
    if (status === 409 && message.includes("out of order")) return res.status(409).json({ ok: false, error: "request is out of order" });
    if (status === 409 && message.includes("already pending")) return res.status(409).json({ ok: false, error: "request is already pending" });
    if (status === 409 && message.includes("lease generation")) return res.status(409).json({ ok: false, error: "request lease expired; retry with the same request ID" });

    const errorId = randomUUID();
    console.error("SAFER request failed", {
      errorId,
      method: req.method,
      path: req.path,
      error: errorMetadata(error)
    });
    return res.status(500).json({
      ok: false,
      error: "요청을 처리하지 못했습니다. 같은 버튼으로 다시 시도해 주세요.",
      errorId
    });
  }

  function rejectRateLimit(res, retryAfterSeconds) {
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
    });
  }

  function enforceSubmitRateLimit(req, res, next) {
    const decision = submitRateLimiter.consume(req.ip);
    if (!decision.allowed) return rejectRateLimit(res, decision.retryAfterSeconds);
    return next();
  }

  function admitLlmRequest(req, res) {
    // rate limit을 먼저 적용해야 거절 요청이 concurrency slot을 점유하지 않는다.
    const rateDecision = llmRateLimiter.consume(req.ip);
    if (!rateDecision.allowed) {
      rejectRateLimit(res, rateDecision.retryAfterSeconds);
      return null;
    }
    const concurrencyDecision = llmConcurrencyGate.tryAcquire();
    if (!concurrencyDecision.allowed) {
      rejectRateLimit(res, 1);
      return null;
    }
    return concurrencyDecision.release;
  }

  async function failStartedRequest(sessionId, requestId, started) {
    if (started?.status !== "started") return;
    try {
      // leaseGeneration은 만료된 worker가 새 lease의 결과를 덮지 못하게 한다.
      await store.failRequest(sessionId, { requestId, leaseGeneration: started.leaseGeneration });
    } catch (error) {
      if (!String(error?.message || error).includes("lease generation")) throw error;
    }
  }

  async function beginSessionRequest(req, res, operation, turn, usesLlm = false) {
    const session = await requireSession(req, res);
    if (!session) return null;
    const requestId = getRequestId(req);
    const request = await store.beginRequest(session.sessionId, {
      requestId,
      operation,
      ...(turn === undefined ? {} : { turn })
    });
    if (request.status === "completed") {
      res.json(request.response);
      return null;
    }
    if (request.status === "pending") {
      res.status(409).json({ ok: false, error: "request is already pending" });
      return null;
    }
    let releaseLlm;
    if (usesLlm) {
      releaseLlm = admitLlmRequest(req, res);
      if (!releaseLlm) {
        await store.failRequest(session.sessionId, {
          requestId,
          leaseGeneration: request.leaseGeneration
        });
        return null;
      }
    }
    return { session, requestId, request, releaseLlm };
  }

  return {
    admitLlmRequest,
    beginSessionRequest,
    enforceSubmitRateLimit,
    errorMetadata,
    failStartedRequest,
    getRequestId,
    publicRequestError,
    requireSession
  };
}

module.exports = { createSessionRequests };
