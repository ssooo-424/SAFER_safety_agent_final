(function exposeApiClient(factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.SaferApi = api;
  }
})(function createApiClientModule() {
  const DEFAULT_TIMEOUT_MS = 45_000;

  class ApiClientError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "ApiClientError";
      this.kind = details.kind || "server";
      this.status = details.status || null;
      this.retryable = details.retryable === true;
    }
  }

  function createApiClient(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    if (typeof fetchImpl !== "function") {
      throw new Error("이 브라우저에서는 서버 연결 기능을 사용할 수 없습니다.");
    }

    async function postJson(url, body, requestId) {
      if (!requestId) {
        throw new ApiClientError("요청 식별자가 없습니다.", { kind: "request", retryable: false });
      }

      // X-Request-Id는 서버 idempotency용이며, 중복 side effect를 피하려고 client는 자동 재시도하지 않는다.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          credentials: "same-origin",
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const responseText = await response.text();
        let data;

        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new ApiClientError("서버 응답을 읽을 수 없습니다. 다시 시도해 주세요.", {
            kind: "response",
            status: response.status,
            retryable: response.status >= 500,
          });
        }

        if (!response.ok || data.ok === false) {
          throw new ApiClientError(data.error || "서버 요청이 처리되지 않았습니다. 다시 시도해 주세요.", {
            kind: "server",
            status: response.status,
            retryable: response.status === 429 || response.status >= 500 || response.status === 0,
          });
        }

        return data;
      } catch (error) {
        if (error instanceof ApiClientError) {
          throw error;
        }

        if (controller.signal.aborted || error?.name === "AbortError") {
          throw new ApiClientError("요청 시간이 초과되었습니다. 같은 버튼을 다시 눌러 시도해 주세요.", {
            kind: "timeout",
            retryable: true,
          });
        }

        throw new ApiClientError("네트워크 연결을 확인한 뒤 같은 버튼을 다시 눌러 주세요.", {
          kind: "network",
          retryable: true,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    return { postJson };
  }

  return { ApiClientError, DEFAULT_TIMEOUT_MS, createApiClient };
});
