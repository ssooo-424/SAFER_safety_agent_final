// WHY: Turn 4~6은 생성 prompt 이후의 deterministic feedback lifecycle을 공유한다.
const futureSelfPersona =
  require("../../safer_personas/future_self.json");

const educatorAgent =
  require("../educator");

const {
  cleanText,
  normalizeTurn5Evaluation
} = educatorAgent;

function getTurn4Question({
  participantContext = {},
  safetyCase = {}
} = {}) {
  const question =
    futureSelfPersona.turns?.["4"]
      ?.question_template ||
    "그래, 아직은 상상되지 않을 수 있어. 하지만 안전수칙을 잘 지키면 지금의 너는 이 사고를 막을 수 있어. 이 사고를 막기 위해 어떤 안전수칙을 지켜야 한다고 생각해? 생각나는 걸 말해줘.";

  return question;
}

function buildTurn5EvaluationMessages({
  safetyCase,
  userMessage = ""
}) {
  return educatorAgent
    .buildTurn5EvaluationMessages({
      safetyCase,
      userMessage
    });
}

function getKoreanRuleCountLabel(
  count
) {
  if (count === 1) {
    return "한 가지";
  }

  if (count === 2) {
    return "두 가지";
  }

  if (count === 3) {
    return "세 가지";
  }

  return `${count}가지`;
}

function joinCoveredAcknowledgements(
  items = []
) {
  return items
    .map(
      item =>
        cleanText(
          item.action
        )
    )
    .filter(Boolean)
    .join(", ");
}

function buildTurn5Feedback({
  safetyCase,
  userMessage = "",
  evaluation = {},
  participantContext = {}
}) {
  const coverage =
    normalizeTurn5Evaluation(
      evaluation,
      safetyCase
    );

  const covered =
    coverage.filter(
      item =>
        item.status ===
        "covered"
    );

  const missing =
    coverage.filter(
      item =>
        item.status ===
        "not_covered"
    );

  const lines = [];

  if (covered.length > 0) {
    const coveredText =
      joinCoveredAcknowledgements(
        covered
      );

    lines.push(
      `맞아. 네가 말한 ${coveredText}, 그 행동을 그때 했더라면 내가 겪은 사고와 고통을 막을 수 있었어.`
    );

    if (missing.length > 0) {
      lines.push("");
      lines.push(
        `하지만 이 미래를 바꾸려면 ${getKoreanRuleCountLabel(missing.length)}를 더 기억해야 해.`
      );
      lines.push("");

      missing.forEach(
        (item, index) => {
          lines.push(
            `${index + 1}. ${item.action}`
          );
        }
      );

      lines.push("");
      lines.push(
        "지금의 너에게는 아직 이 미래를 바꿀 기회가 있어. 작업 전에 꼭 확인해줘."
      );
    } else {
      lines.push("");
      lines.push(
        "세 가지 핵심 안전수칙을 다 잘 짚었어."
      );
      lines.push("");
      lines.push(
        "지금의 너에게는 아직 이 미래를 바꿀 기회가 있어. 세 가지를 반드시 실천해줘."
      );
    }
  } else {
    const normalizedUser =
      cleanText(userMessage);

    const doesNotKnow =
      !normalizedUser ||
      /모르겠|잘 모르|생각이 안|생각나지 않|없습니다|몰라/.test(
        normalizedUser
      );

    if (doesNotKnow) {
      lines.push(
        "괜찮아. 하지만 내가 겪은 사고와 고통을 피하려면 지금부터 다음 세 가지를 기억해줘."
      );
    } else {
      lines.push(
        "말해준 내용만으로는 내가 겪은 사고를 막기 어려워. 이 미래를 바꾸려면 다음 세 가지를 기억해줘."
      );
    }

    lines.push("");

    coverage.forEach(
      (item, index) => {
        lines.push(
          `${index + 1}. ${item.action}`
        );
      }
    );

    lines.push("");
    lines.push(
      "지금의 너에게는 아직 이 미래를 바꿀 기회가 있어. 작업 전에 반드시 확인해줘."
    );
  }

  return {
    assistant:
      lines.join("\n"),
    coverage,
    coveredRuleIds:
      covered.map(
        item =>
          item.rule_id
      ),
    missingRuleIds:
      missing.map(
        item =>
          item.rule_id
      ),
    coveredCount:
      covered.length,
    missingCount:
      missing.length
  };
}

function buildTurn6Feedback({
  safetyCase
}) {
  if (!safetyCase) {
    throw new Error(
      "Future Self Turn 6 생성에 safetyCase가 필요합니다."
    );
  }

  const safetyRules =
    Array.isArray(
      safetyCase.safety_rules
    )
      ? safetyCase
          .safety_rules
          .slice(0, 3)
      : [];

  if (safetyRules.length !== 3) {
    throw new Error(
      "Future Self Turn 6 requires exactly 3 safety_rules"
    );
  }

  const ruleActions =
    safetyRules.map(
      (rule, index) => {
        const action =
          cleanText(rule?.action);

        if (!action) {
          throw new Error(
            `Future Self Turn 6 safety_rule ${index + 1} action is empty`
          );
        }

        return action;
      }
    );

  const lines = [
    "3년 전의 너에게는 아직 내가 겪은 미래를 바꿀 기회가 있어. 마지막으로 꼭 지켜야 할 핵심 안전수칙 세 가지를 정리할게.",
    "",
    `1. ${ruleActions[0]}`,
    "",
    `2. ${ruleActions[1]}`,
    "",
    `3. ${ruleActions[2]}`,
    "",
    "세 가지를 모두 확인한 뒤, 지금의 네가 현장에서 가장 자신 있게 지킬 수 있는 안전수칙 하나를 선택해줘."
  ];

  return {
    assistant:
      lines.join("\n"),
    safetyRules:
      ruleActions.map(
        (action, index) => ({
          rule_id:
            index + 1,
          action
        })
      )
  };
}

module.exports = {
  getTurn4Question,
  buildTurn5EvaluationMessages,
  buildTurn5Feedback,
  buildTurn6Feedback
};
