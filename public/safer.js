const { CONDITION_META, elements, state } = window.SaferState;
const apiClient = window.SaferApi.createApiClient();
const turnTiming = window.SaferTurnTiming.createTurnTimingTracker();
const speechController = window.SaferVoice.createSpeechController({
  fetchImpl: window.fetch.bind(window),
  AudioConstructor: window.Audio,
  onError: message => showNotice(message)
});
let chatView;
let conversation;
let ruleSelection;

function syncTurnTimings() {
  void apiClient.postJson(
    "/api/safer-timing",
    { turnTimings: turnTiming.snapshot() },
    crypto.randomUUID()
  ).catch(() => undefined);
}

function completeTurnTiming(action) {
  const completed = turnTiming.complete(action);
  if (completed) syncTurnTimings();
}

const dictationController = window.SaferVoice.createDictationController({
  RecognitionConstructor: window.SpeechRecognition || window.webkitSpeechRecognition,
  onText: text => {
    // SAFER는 transcript만 보관하며 raw audio는 녹음·전송하지 않는다.
    elements.chatInput.value = text.slice(0, 1000);
    if (text.trim()) state.inputMethod = "dictation";
    resizeChatInput();
  },
  onStateChange: nextState => chatView.renderDictationState(nextState),
  onError: error => showNotice(getDictationErrorMessage(error))
});

const requestGateway = window.SaferRequestEvents.createRequestGateway(apiClient);

function getDictationErrorMessage(error) {
  const messages = {
    "not-allowed": "마이크 권한을 허용한 뒤 다시 눌러 주세요.",
    "service-not-allowed": "이 브라우저에서는 음성 인식 권한을 사용할 수 없습니다.",
    "no-speech": "음성이 인식되지 않았습니다. 다시 눌러 천천히 말씀해 주세요.",
    network: "음성 인식에 네트워크 연결이 필요합니다.",
    "audio-capture": "마이크를 사용할 수 없습니다. 기기 설정을 확인해 주세요."
  };
  return messages[error] ||
    "음성 인식을 시작하지 못했습니다. 키보드로 입력하거나 다시 시도해 주세요.";
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
    });
  });
}

function appendBubble(text, role, options = {}) {
  // 기존 실험 화면과 transcript를 보존하려고 `|||`도 한 bubble의 text로 그대로 렌더링한다.
  const bubble = chatView.createBubble(text, role, options);
  elements.chatBox.insertBefore(bubble, elements.typing);
  bubble.addEventListener("animationend", scrollChatToBottom, { once: true });
  scrollChatToBottom();
}

function getAssistantTypingDelay(text, messageIndex) {
  if (messageIndex === 0) return 600;
  const estimatedDelay = 700 + String(text || "").trim().length * 12;
  return Math.min(1800, Math.max(900, estimatedDelay));
}

async function appendAssistantMessages(messages) {
  const normalizedMessages = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);
  const combinedTtsText = normalizedMessages
    .map(message => String(message || "").trim())
    .filter(Boolean)
    .join("\n\n");
  for (let index = 0; index < normalizedMessages.length; index += 1) {
    const message = normalizedMessages[index];
    chatView.setBusy(true);
    scrollChatToBottom();
    await new Promise(resolve => window.setTimeout(
      resolve,
      getAssistantTypingDelay(message, index)
    ));
    chatView.setBusy(false);
    appendBubble(message, "assistant", {
      showTts: index === 0,
      ttsText: index === 0 ? combinedTtsText : ""
    });
  }
}

function clearControls() {
  chatView.clearControls();
  scrollChatToBottom();
}

function showAnswerInput() {
  chatView.showAnswerInput();
  scrollChatToBottom();
}

function showNotice(message) {
  chatView.showNotice(message);
}

function clearNotice() {
  chatView.clearNotice();
}

function resizeChatInput() {
  chatView.resizeChatInput();
}

function showQuickReply({ label, userText = "", onSelect }) {
  clearControls();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quick-reply-button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    if (state.busy) return;
    const timingStage = turnTiming.currentStage();
    completeTurnTiming("quick_reply");
    clearNotice();
    if (userText) appendBubble(userText, "user");
    clearControls();
    try {
      await onSelect();
    } catch (error) {
      showNotice(error.message);
      if (timingStage) turnTiming.start(timingStage);
      showQuickReply({ label: "다시 시도하기", onSelect });
    }
  });
  elements.quickReplies.appendChild(button);
  scrollChatToBottom();
}

function showMissingRuleConfirmation(missingRuleIds = []) {
  const shown = ruleSelection.showMissingRuleConfirmation(missingRuleIds);
  if (!shown) {
    showQuickReply({
      label: "세 가지 핵심 안전수칙 확인하기",
      onSelect: revealFinalSafetyRules
    });
  }
  scrollChatToBottom();
}

function showFinalRuleSelection() {
  ruleSelection.showFinalRuleSelection();
  scrollChatToBottom();
}

function hasHangulFinalConsonant(value) {
  const lastCharacter = Array.from(String(value ?? "").trim()).at(-1);
  if (!lastCharacter) return false;
  const codePoint = lastCharacter.codePointAt(0);
  return codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 !== 0;
}

function withObjectParticle(value) {
  return `${value}${hasHangulFinalConsonant(value) ? "을" : "를"}`;
}

function getWorkAwarenessMessage(work) {
  const workWithObjectParticle = withObjectParticle(work);
  if (state.condition === "coworker") {
    return `나도 같은 종류의 작업을 하다가 실제로 사고를 겪었어.\n나도 그때는 내가 사고를 당하게 될 줄 몰랐어.`;
  }
  if (state.condition === "future_self") {
    return `오늘 ${workWithObjectParticle} 할 예정이지?\n내가 ${work}에서 겪은 일에 대해 말해줄게.`;
  }
  return `오늘은 ${workWithObjectParticle} 할 예정이시군요. 현재 작업 상황을 확인했습니다. 먼저 사전설문에서 선택하신 이 공정의 실제 사고사례를 말씀드리겠습니다.`;
}

async function withTyping(task) {
  const startedAt = Date.now();
  chatView.setBusy(true);
  scrollChatToBottom();
  try {
    const result = await task();
    const remaining = 450 - (Date.now() - startedAt);
    if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining));
    return result;
  } finally {
    chatView.setBusy(false);
    scrollChatToBottom();
  }
}

function postJson(url, body) {
  return requestGateway.postJson(url, body);
}

async function fetchIntroScript() {
  const result = await withTyping(() => postJson("/api/safer-intro", {}));
  return result.script;
}

function fetchTurn(turn) {
  return withTyping(() => postJson("/api/safer-chat", { turn }));
}

async function revealFinalSafetyRules() {
  clearControls();
  try {
    const result = await fetchTurn(6);
    appendBubble(result.assistant, "assistant");
    state.currentTurn = 6;
    showFinalRuleSelection();
  } catch (error) {
    showNotice(error.message);
    showMissingRuleConfirmation(state.missingRuleIds);
  }
}

async function submitPreventionAnswer() {
  if (state.busy || state.currentTurn !== 4) return;
  const answer = elements.chatInput.value.trim();
  const inputMethod = state.inputMethod;
  if (!answer) {
    showNotice("사고를 예방하기 위해 필요했던 행동을 입력해 주세요.");
    elements.chatInput.focus();
    return;
  }
  completeTurnTiming(inputMethod === "dictation" ? "dictation_submit" : "keyboard_submit");
  clearNotice();
  clearControls();
  appendBubble(answer, "user");
  try {
    const result = await withTyping(() => postJson("/api/safer-chat", {
      turn: 5,
      userMessage: answer,
      inputMethod
    }));
    appendBubble(result.assistant, "assistant");
    state.missingRuleIds = result.evaluation?.missingRuleIds || [];
    state.currentTurn = 5;
    conversation.showNavigationForCurrentTurn();
  } catch (error) {
    showNotice(error.message);
    showAnswerInput();
    state.inputMethod = inputMethod;
    elements.chatInput.value = answer;
    resizeChatInput();
  }
}

async function startConversation() {
  clearControls();
  clearNotice();
  const result = await withTyping(() => postJson("/api/safer-start", {}));
  state.safetyCase = result.safetyCase;
  state.condition = result.condition;
  state.currentTurn = 0;
  state.introScript = null;
  state.organizationalOutcomeShown = false;
  const actualCase = state.safetyCase?.actual_case || {};
  chatView.renderContext({
    work: actualCase.process_content,
    riskType: actualCase.risk_type,
    trigger: actualCase.trigger
  });
  chatView.renderAgentHeader(CONDITION_META);
  appendBubble(result.turn0.assistant, "assistant");
  conversation.showNavigationForCurrentTurn();
}

async function initialize() {
  try {
    await startConversation();
  } catch (error) {
    chatView.setBusy(false);
    showNotice(error.message);
    showQuickReply({ label: "다시 시도하기", onSelect: startConversation });
  }
}

chatView = window.SaferView.createChatView({
  elements, state, speechController, dictationController
});
ruleSelection = window.SaferRuleSelection.createRuleSelection({
  elements,
  state,
  clearControls,
  appendBubble,
  showQuickReply
});
conversation = window.SaferConversation.createConversation({
  state,
  displayRawValue: window.SaferView.displayRawValue,
  appendBubble,
  appendAssistantMessages,
  showQuickReply,
  showAnswerInput,
  showMissingRuleConfirmation,
  showFinalRuleSelection,
  getWorkAwarenessMessage,
  fetchIntroScript,
  fetchTurn,
  startTurnTiming: stage => turnTiming.start(stage)
});

if (!dictationController.supported) {
  elements.voiceInputButton.disabled = true;
  elements.voiceInputButton.title = "이 브라우저는 음성 입력을 지원하지 않습니다.";
  elements.voiceInputButton.setAttribute("aria-label", "음성 입력을 지원하지 않는 브라우저");
}

window.SaferRequestEvents.bindParticipantEvents({
  elements, state, dictationController, clearNotice, showNotice, resizeChatInput,
  submitPreventionAnswer, appendBubble, revealFinalSafetyRules,
  completeRuleSelection: () => {
    completeTurnTiming("rule_selected");
    ruleSelection.completeSelection();
  },
  completeTurnTiming
});
window.addEventListener("resize", scrollChatToBottom);
window.SaferRequestEvents.bindWindowLifecycle({ dictationController, speechController });
initialize();
