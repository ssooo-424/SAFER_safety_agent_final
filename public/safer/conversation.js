(function exposeSaferConversation() {
  function createConversation(options) {
    const {
      state, displayRawValue, appendBubble, showQuickReply, showAnswerInput,
      showMissingRuleConfirmation, showFinalRuleSelection, getWorkAwarenessMessage,
      fetchIntroScript, fetchTurn
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
        return;
      }
      if (turn === 1) {
        showQuickReply({
          label: "사고 원인 알아보기",
          userText: state.condition === "future_self"
            ? "사고 원인은 뭐였어?" : "사고 원인은 무엇이었나요?",
          onSelect: advanceConversation
        });
        return;
      }
      if (turn === 2) {
        showQuickReply({
          label: "사고 결과 확인하기",
          userText: state.condition === "future_self"
            ? "그 사고로 어떻게 됐어?" : "사고로 어떤 피해가 발생했나요?",
          onSelect: advanceConversation
        });
        return;
      }
      if (turn === 3) {
        showQuickReply({
          label: state.condition === "future_self" ? "미래 상상해보기" : "예방 방법 생각해보기",
          userText: getTurnThreeReply(state.condition),
          onSelect: advanceConversation
        });
        return;
      }
      if (turn === 4) {
        showAnswerInput();
        return;
      }
      if (turn === 5) {
        showMissingRuleConfirmation(state.missingRuleIds);
        return;
      }
      if (turn === 6) showFinalRuleSelection();
    }

    async function advanceConversation() {
      // currentTurn은 방금 끝난 stage라서 다음 API/화면 stage는 항상 +1로 파생한다.
      const nextTurn = state.currentTurn + 1;
      if (nextTurn >= 1 && nextTurn <= 3) {
        await ensureIntroScript();
        if (nextTurn === 1) {
          const work = displayRawValue(
            state.safetyCase?.actual_case?.process_content ||
            state.safetyCase?.scenario?.process_content ||
            state.safetyCase?.scenario?.detail_process
          );
          appendBubble(getWorkAwarenessMessage(work), "assistant");
        }
        const messages = nextTurn === 3 && Array.isArray(state.introScript.turn3Messages)
          ? state.introScript.turn3Messages
          : [state.introScript[`turn${nextTurn}`]];
        messages.filter(Boolean).forEach(message => appendBubble(message, "assistant"));
      } else if (nextTurn === 4 || nextTurn === 6) {
        const result = await fetchTurn(nextTurn);
        appendBubble(result.assistant, "assistant");
      }
      state.currentTurn = nextTurn;
      showNavigationForCurrentTurn();
    }

    return { advanceConversation, showNavigationForCurrentTurn };
  }

  function getTurnThreeReply(condition) {
    if (condition === "future_self") return "아니, 상상되지 않아.";
    if (condition === "coworker") return "사고를 막으려면 무엇을 해야 할지 생각해볼게.";
    return "사고를 막기 위해 필요한 안전조치를 생각해보겠습니다.";
  }

  window.SaferConversation = { createConversation };
})();
