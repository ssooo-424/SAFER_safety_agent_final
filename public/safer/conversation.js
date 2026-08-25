(function exposeSaferConversation() {
  function createConversation(options) {
    const {
      state, displayRawValue, appendBubble, appendAssistantMessages, showQuickReply, showAnswerInput,
      showMissingRuleConfirmation, showFinalRuleSelection, getWorkAwarenessMessage,
      fetchIntroScript, fetchTurn, startTurnTiming
    } = options;

    async function ensureIntroScript() {
      if (!state.introScript) state.introScript = await fetchIntroScript();
    }

    function showNavigationForCurrentTurn() {
      const turn = state.currentTurn;
      if (turn === 0) {
        showQuickReply({
          label: "인사 나누기",
          userText: state.condition === "future_self" ? "안녕." : "안녕하세요.",
          onSelect: advanceConversation
        });
        startTurnTiming("turn0");
        return;
      }
      if (turn === 1) {
        showQuickReply({
          label: "사고 원인 알아보기",
          userText: state.condition === "future_self"
            ? "사고 원인은 뭐였어?" : "사고 원인은 무엇이었나요?",
          onSelect: advanceConversation
        });
        startTurnTiming("turn1");
        return;
      }
      if (turn === 2) {
        showQuickReply({
          label: "사고 결과 확인하기",
          userText: state.condition === "future_self"
            ? "그 사고로 어떻게 됐어?" : "사고로 어떤 피해가 발생했나요?",
          onSelect: advanceConversation
        });
        startTurnTiming("turn2");
        return;
      }
      if (turn === 3) {
        if (!state.organizationalOutcomeShown) {
          showQuickReply({
            label: "사고 이후 현장 상황 확인하기",
            userText: getOrganizationalOutcomeReply(state.condition),
            onSelect: showOrganizationalOutcome
          });
          startTurnTiming("turn3");
          return;
        }
        showQuickReply({
          label: "예방 방법 생각해보기",
          userText: getPreventionTransitionReply(state.condition),
          onSelect: advanceConversation
        });
        startTurnTiming("organizational_outcome");
        return;
      }
      if (turn === 4) {
        showAnswerInput();
        startTurnTiming("turn4");
        return;
      }
      if (turn === 5) {
        showMissingRuleConfirmation(state.missingRuleIds);
        startTurnTiming("turn5");
        return;
      }
      if (turn === 6) {
        showFinalRuleSelection();
        startTurnTiming("turn6");
      }
    }

    async function advanceConversation() {
      // currentTurn은 방금 끝난 stage라서 다음 API/화면 stage는 항상 +1로 파생한다.
      const nextTurn = state.currentTurn + 1;
      if (nextTurn >= 1 && nextTurn <= 3) {
        await ensureIntroScript();
        const messages = [];
        if (nextTurn === 1) {
          const work = displayRawValue(
            state.safetyCase?.actual_case?.process_content ||
            state.safetyCase?.scenario?.process_content ||
            state.safetyCase?.scenario?.detail_process
          );
          messages.push(getWorkAwarenessMessage(work));
        }
        const turnMessages = nextTurn === 3 && Array.isArray(state.introScript.turn3Messages)
          ? state.introScript.turn3Messages
          : [state.introScript[`turn${nextTurn}`]];
        messages.push(...turnMessages.filter(Boolean));
        await appendAssistantMessages(messages);
      } else if (nextTurn === 4 || nextTurn === 6) {
        const result = await fetchTurn(nextTurn);
        appendBubble(result.assistant, "assistant");
      }
      state.currentTurn = nextTurn;
      showNavigationForCurrentTurn();
    }

    async function showOrganizationalOutcome() {
      await ensureIntroScript();
      const messages = Array.isArray(state.introScript.organizationalOutcomeMessages)
        ? state.introScript.organizationalOutcomeMessages.filter(Boolean)
        : [];
      if (!messages.length) {
        throw new Error("사고 이후 현장 결과를 불러오지 못했습니다.");
      }
      await appendAssistantMessages(messages);
      state.organizationalOutcomeShown = true;
      showNavigationForCurrentTurn();
    }

    return { advanceConversation, showNavigationForCurrentTurn };
  }

  function getOrganizationalOutcomeReply(condition) {
    if (condition === "future_self") {
      return "아니, 상상되지 않아. 그 사고 뒤에 현장과 회사는 어떻게 됐어?";
    }
    if (condition === "coworker") return "사고가 난 뒤 현장은 어떻게 됐어?";
    return "사고 이후 현장과 회사에는 어떤 일이 발생했나요?";
  }

  function getPreventionTransitionReply(condition) {
    if (condition === "future_self") return "이런 사고를 막으려면 어떤 안전수칙이 필요한지 생각해볼게.";
    if (condition === "coworker") return "사고를 막으려면 무엇을 해야 할지 생각해볼게.";
    return "사고를 막기 위해 필요한 안전조치를 생각해보겠습니다.";
  }

  window.SaferConversation = { createConversation };
})();
