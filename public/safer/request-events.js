(function exposeSaferRequestEvents() {
  const REQUEST_ID_PREFIX = "safer-operation-request-id:";

  function createRequestGateway(apiClient) {
    function getOperationRequestId(operation) {
      const key = `${REQUEST_ID_PREFIX}${operation}`;
      const existing = sessionStorage.getItem(key);
      if (existing) return { key, requestId: existing };
      const requestId = crypto.randomUUID();
      sessionStorage.setItem(key, requestId);
      return { key, requestId };
    }

    async function postJson(url, body) {
      const operation = url === "/api/safer-chat"
        ? `chat-${body.turn}`
        : url.slice("/api/safer-".length);
      // 실패한 동일 operation은 같은 ID를 써야 server idempotency가 retry 중복 저장을 막는다.
      const request = getOperationRequestId(operation);
      const result = await apiClient.postJson(url, body, request.requestId);
      sessionStorage.removeItem(request.key);
      return result;
    }

    return { postJson };
  }

  function bindWindowLifecycle({ dictationController, speechController }) {
    window.addEventListener("beforeunload", () => {
      dictationController.stop();
      speechController.cancel();
    });
  }

  function bindParticipantEvents(options) {
    const {
      elements, state, dictationController, clearNotice, showNotice,
      resizeChatInput, submitPreventionAnswer, appendBubble,
      revealFinalSafetyRules, completeRuleSelection
    } = options;
    elements.voiceInputButton.addEventListener("click", () => {
      if (state.busy || state.currentTurn !== 4) return;
      if (!dictationController.supported) {
        showNotice("이 브라우저에서는 음성 입력을 사용할 수 없습니다. 키보드로 입력해 주세요.");
        return;
      }
      clearNotice();
      dictationController.toggle(elements.chatInput.value);
    });
    elements.chatForm.addEventListener("submit", event => {
      event.preventDefault();
      submitPreventionAnswer();
    });
    elements.chatInput.addEventListener("input", resizeChatInput);
    elements.chatInput.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      submitPreventionAnswer();
    });
    elements.ruleConfirmButton.addEventListener("click", async () => {
      if (state.busy || elements.ruleConfirmButton.disabled) return;
      appendBubble(
        state.condition === "future_self"
          ? "빠졌던 안전수칙을 모두 확인했어."
          : "답변에서 빠졌던 안전수칙을 모두 확인했습니다.",
        "user"
      );
      await revealFinalSafetyRules();
    });
    elements.ruleSelectButton.addEventListener("click", completeRuleSelection);
  }

  window.SaferRequestEvents = {
    bindParticipantEvents,
    bindWindowLifecycle,
    createRequestGateway
  };
})();
