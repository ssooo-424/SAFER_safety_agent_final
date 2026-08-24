function formatRulesForPrompt(rules) {
  const ordinals = ["첫째", "둘째", "셋째"];
  return rules.map((rule, index) => {
    let text = `[수칙 ${index + 1}]\n"${ordinals[index]}, ${rule.action}." (행동 말풍선 — 짧고 명확하게)`;
    if (rule.missingPoint && rule.sameKindPhrase) {
      text += `\n→ 이어서 별도 말풍선: "${rule.sameKindPhrase}, ${rule.missingPoint} 다시 잡아줄 거야" 톤으로 자연스럽게 재구성 (직접 인용 금지)`;
    } else {
      text += `\n→ 이어서 별도 말풍선: 이 수칙이 왜 중요한지 한 문장으로`;
    }
    return text;
  }).join("\n\n");
}

function buildRulesBubbles(rules) {
  const ordinals = ["첫째", "둘째", "셋째"];
  const bubbles = [];
  rules.forEach((rule, index) => {
    bubbles.push(`"${ordinals[index]}, ${rule.action}."`);
    if (rule.missingPoint && rule.sameKindPhrase) {
      bubbles.push(`"${rule.sameKindPhrase}, ${rule.missingPoint} 다시 잡아줄 거야."`);
    } else {
      bubbles.push(`"이 수칙은 사고를 막는 데 꼭 필요해."`);
    }
  });
  return bubbles.join(" ||| ");
}

function buildRulesForReport(rules) {
  return rules.map((rule, index) => {
    let line = `${index + 1}. ${rule.action}`;
    if (rule.missingPoint && rule.sameKindPhrase) {
      line += `\n   → ${rule.sameKindPhrase}, ${rule.missingPoint} 다시 점검하는 것이 중요합니다.`;
    }
    return line;
  }).join("\n\n");
}

module.exports = {
  formatRulesForPrompt,
  buildRulesBubbles,
  buildRulesForReport
};
