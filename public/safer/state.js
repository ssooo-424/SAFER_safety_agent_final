(function exposeSaferState() {
  const CONDITION_META = {
    educator: { name: "AI 안전교육자", avatar: "EDU" },
    coworker: { name: "동료 작업자 AI", avatar: "PEER" },
    future_self: { name: "미래의 나 AI", avatar: "3Y" }
  };

  const elements = {
    agentAvatar: document.getElementById("agent-avatar"),
    agentName: document.getElementById("agent-name"),
    chatBox: document.getElementById("chat-box"),
    typing: document.getElementById("typing"),
    quickReplies: document.getElementById("quick-replies"),
    ruleConfirmPanel: document.getElementById("rule-confirm-panel"),
    ruleConfirmDescription: document.getElementById("rule-confirm-description"),
    ruleConfirmList: document.getElementById("rule-confirm-list"),
    ruleConfirmButton: document.getElementById("rule-confirm-button"),
    ruleSelectPanel: document.getElementById("rule-select-panel"),
    ruleSelectList: document.getElementById("rule-select-list"),
    ruleSelectButton: document.getElementById("rule-select-button"),
    scenarioRecallCard: document.getElementById("scenario-recall-card"),
    scenarioRecallWork: document.getElementById("scenario-recall-work"),
    scenarioRecallRisk: document.getElementById("scenario-recall-risk"),
    scenarioRecallSummary: document.getElementById("scenario-recall-summary"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
    voiceInputButton: document.getElementById("voice-input-button"),
    sendButton: document.getElementById("send-button"),
    notice: document.getElementById("chat-notice")
  };

  const state = {
    condition: "",
    safetyCase: null,
    introScript: null,
    organizationalOutcomeShown: false,
    missingRuleIds: [],
    currentTurn: -1,
    busy: false,
    inputMethod: "keyboard",
    messageSequence: 0
  };

  window.SaferState = {
    CONDITION_META,
    ALL_CONDITIONS: Object.keys(CONDITION_META),
    elements,
    state
  };
})();
