(function exposeSaferRuleSelection() {
  function createRuleSelection(options) {
    const { elements, state, clearControls, appendBubble, showQuickReply } = options;
    function getSafetyRuleActions() {
      return (state.safetyCase?.safety_rules || [])
        .slice(0, 3)
        .map((rule, index) => ({
          ruleId: index + 1,
          action: String(rule?.action || "").trim()
        }))
        .filter(rule => rule.action);
    }

    function createRuleOption({ type, name, rule }) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");
      label.className = "rule-option";
      input.type = type;
      input.name = name;
      input.value = String(rule.ruleId);
      text.textContent = `${rule.ruleId}. ${rule.action}`;
      label.appendChild(input);
      label.appendChild(text);
      return { label, input };
    }

    function showMissingRuleConfirmation(missingRuleIds = []) {
      clearControls();
      const missingRules = getSafetyRuleActions()
        .filter(rule => missingRuleIds.includes(rule.ruleId));
      if (!missingRules.length) return false;

      elements.ruleConfirmDescription.textContent =
        "답변에서 빠졌던 안전수칙입니다. 내용을 읽고 모두 체크해 주세요.";
      elements.ruleConfirmList.innerHTML = "";
      elements.ruleConfirmButton.disabled = true;
      missingRules.forEach(rule => {
        const option = createRuleOption({
          type: "checkbox",
          name: "missing-rule-confirmation",
          rule
        });
        option.input.addEventListener("change", () => {
          const inputs = Array.from(elements.ruleConfirmList.querySelectorAll("input"));
          elements.ruleConfirmButton.disabled = !inputs.every(input => input.checked);
        });
        elements.ruleConfirmList.appendChild(option.label);
      });
      elements.ruleConfirmPanel.hidden = false;
      return true;
    }

    function showFinalRuleSelection() {
      clearControls();
      elements.ruleSelectList.innerHTML = "";
      elements.ruleSelectButton.disabled = true;
      getSafetyRuleActions().forEach(rule => {
        const option = createRuleOption({
          type: "radio",
          name: "confident-safety-rule",
          rule
        });
        option.input.addEventListener("change", () => {
          elements.ruleSelectButton.disabled = false;
        });
        elements.ruleSelectList.appendChild(option.label);
      });
      elements.ruleSelectPanel.hidden = false;
    }

    function getSelectedRule() {
      const selected = elements.ruleSelectList.querySelector("input:checked");
      return getSafetyRuleActions().find(rule => rule.ruleId === Number(selected?.value));
    }

    function completeSelection() {
      if (state.busy || elements.ruleSelectButton.disabled) return;
      const selectedRule = getSelectedRule();
      if (!selectedRule) return;
      localStorage.setItem("commitSelectedRule", selectedRule.action);
      clearControls();
      appendBubble(
        state.condition === "future_self"
          ? `나는 이 안전수칙을 가장 자신 있게 지킬 수 있을 것 같아: ${selectedRule.action}`
          : `가장 자신 있게 지킬 수 있는 안전수칙은 “${selectedRule.action}”입니다.`,
        "user"
      );
      const closingMessages = {
        educator: "좋습니다. 선택한 안전수칙부터 확실히 실천하되, 사고를 예방하려면 오늘 확인한 세 가지 안전수칙을 모두 작업 전에 확인하고 실천하시기 바랍니다.",
        coworker: "좋아. 가장 자신 있는 수칙부터 확실히 지키고, 오늘 확인한 세 가지 안전수칙도 작업 전에 우리 같이 모두 확인하고 실천하자.",
        future_self: "좋아. 가장 자신 있는 수칙부터 꼭 지켜줘. 그리고 이 미래를 바꾸려면 오늘 확인한 세 가지 안전수칙을 모두 작업 전에 확인하고 실천해줘."
      };
      appendBubble(closingMessages[state.condition], "assistant");
      showQuickReply({
        label: "사후설문으로 이동",
        onSelect: async () => { window.location.href = "/post-survey.html"; }
      });
    }

    return { completeSelection, showFinalRuleSelection, showMissingRuleConfirmation };
  }

  window.SaferRuleSelection = { createRuleSelection };
})();
