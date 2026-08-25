(function exposeSaferView() {
  function createChatView({ elements, state, speechController, dictationController }) {
    function createBubble(text, role, { ttsText = "", showTts = true } = {}) {
      const normalizedText = String(text || "").trim();
      const normalizedTtsText = String(ttsText || normalizedText).trim();
      const bubble = document.createElement("div");
      const bubbleText = document.createElement("div");
      bubble.className = `bubble ${role}`;
      bubbleText.className = "bubble-text";
      bubbleText.textContent = normalizedText;
      bubble.appendChild(bubbleText);

      if (
        role !== "assistant" ||
        !normalizedText ||
        !normalizedTtsText ||
        !showTts ||
        !speechController.supported
      ) {
        return bubble;
      }

      state.messageSequence += 1;
      const messageId = `assistant-message-${state.messageSequence}`;
      const ttsButton = document.createElement("button");
      ttsButton.type = "button";
      ttsButton.className = "message-tts-button";

      function renderSpeechState(speechState) {
        const speaking = speechState === "speaking";
        const loading = speechState === "loading";
        const active = speaking || loading;
        ttsButton.classList.toggle("is-speaking", active);
        ttsButton.setAttribute("aria-pressed", active ? "true" : "false");
        ttsButton.setAttribute("aria-busy", loading ? "true" : "false");
        ttsButton.setAttribute(
          "aria-label",
          active ? "이 AI 메시지 읽기 정지" : "이 AI 메시지 듣기"
        );
        ttsButton.textContent = loading ? "생성 중" : speaking ? "정지" : "듣기";
      }

      renderSpeechState("idle");
      ttsButton.addEventListener("click", () => {
        speechController.toggle({
          id: messageId,
          text: normalizedTtsText,
          onStateChange: renderSpeechState
        });
      });
      bubble.appendChild(ttsButton);
      return bubble;
    }

    function setTyping(visible) {
      elements.typing.hidden = !visible;
      elements.chatBox.setAttribute("aria-busy", visible ? "true" : "false");
    }

    function showNotice(message) {
      elements.notice.textContent = message;
      elements.notice.hidden = false;
    }

    function clearNotice() {
      elements.notice.textContent = "";
      elements.notice.hidden = true;
    }

    function clearControls() {
      dictationController.stop();
      elements.quickReplies.innerHTML = "";
      elements.scenarioRecallCard.hidden = true;
      elements.chatForm.hidden = true;
      elements.ruleConfirmPanel.hidden = true;
      elements.ruleSelectPanel.hidden = true;
    }

    function setBusy(busy) {
      state.busy = busy;
      elements.chatInput.disabled = busy;
      elements.sendButton.disabled = busy;
      elements.voiceInputButton.disabled = busy || !dictationController.supported;
      elements.quickReplies.querySelectorAll("button").forEach(button => {
        button.disabled = busy;
      });
      setTyping(busy);
    }

    function showAnswerInput() {
      clearControls();
      state.inputMethod = "keyboard";
      renderScenarioRecall();
      elements.scenarioRecallCard.hidden = false;
      elements.chatForm.hidden = false;
      elements.chatInput.value = "";
      resizeChatInput();
      elements.chatInput.focus();
    }

    function renderScenarioRecall() {
      const actualCase = state.safetyCase?.actual_case || {};
      const scenario = state.safetyCase?.scenario || {};
      elements.scenarioRecallWork.textContent = displayRawValue(
        actualCase.process || scenario.process_content || scenario.detail_process || scenario.major_process
      );
      elements.scenarioRecallRisk.textContent = displayRawValue(
        actualCase.risk_type || scenario.risk_type
      );
      elements.scenarioRecallSummary.textContent = displayRawValue(actualCase.summary);
    }

    function resizeChatInput() {
      const maxHeight = Number.parseFloat(
        getComputedStyle(elements.chatInput).getPropertyValue("--chat-input-max-height")
      ) || 130;
      elements.chatInput.style.setProperty("--chat-input-height", "auto");
      elements.chatInput.style.setProperty(
        "--chat-input-height",
        `${Math.min(elements.chatInput.scrollHeight, maxHeight)}px`
      );
    }

    function renderDictationState(nextState) {
      const listening = nextState === "listening";
      const label = elements.voiceInputButton.querySelector("span");
      elements.voiceInputButton.classList.toggle("is-listening", listening);
      elements.voiceInputButton.setAttribute("aria-pressed", listening ? "true" : "false");
      elements.voiceInputButton.setAttribute(
        "aria-label",
        listening ? "음성 입력 정지" : "음성으로 답변 입력"
      );
      label.textContent = listening ? "인식 중" : "음성입력";
    }

    function renderContext(actualCase) {
      const scenario = state.safetyCase?.scenario || {};
      elements.contextWork.textContent = displayRawValue(
        actualCase.work || scenario.process_content ||
        scenario.detail_process || scenario.major_process
      );
      elements.contextRisk.textContent = displayRawValue(
        actualCase.riskType || scenario.risk_type
      );
      elements.contextTrigger.textContent = displayRawValue(
        actualCase.trigger || scenario.triggers
      );
    }

    function renderAgentHeader(conditionMeta) {
      const meta = conditionMeta[state.condition];
      elements.agentAvatar.textContent = meta.avatar;
      elements.agentName.textContent = meta.name;
    }

    return {
      clearControls,
      clearNotice,
      createBubble,
      renderAgentHeader,
      renderContext,
      renderDictationState,
      resizeChatInput,
      setBusy,
      showAnswerInput,
      showNotice
    };
  }

  function displayRawValue(value) {
    if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
    return String(value ?? "").trim() || "-";
  }

  window.SaferView = { createChatView, displayRawValue };
})();
