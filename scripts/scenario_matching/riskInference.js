const { buildCaseText } = require("./candidateConstruction");

function inferExpectedRiskTypes(testCase = {}) {
  const provided =
    testCase.expectedRiskTypes ||
    (testCase.expectedRiskType ? [testCase.expectedRiskType] : []);

  if (provided.length > 0) {
    return {
      risks: provided,
      source: "human_expected_risk",
      confidence: "confirmed",
    };
  }

  const text = buildCaseText(testCase);
  const risks = [];
  const add = (risk) => {
    if (!risks.includes(risk)) {
      risks.push(risk);
    }
  };

  if (/감전|활선|전기가 살아|누전/.test(text)) {
    add("감전");
  }

  if (/질식|산소 부족|물에 빠|익사/.test(text)) {
    add("질식");
  }

  if (/화상|화재|불티|착화/.test(text)) {
    add("화상");
  }

  if (/끼임|끼어|끼일|협착|빨려들/.test(text)) {
    add("끼임");
  }

  if (/베이|베거나|절상|절단|찔림|찔려/.test(text)) {
    add("절상");
  }

  if (/매몰|깔림|깔려|붕괴|무너져/.test(text)) {
    add("깔림");
  }

  const objectStrike =
    /(인양물|자재|차량|지게차|굴착기|장비).{0,35}(충돌|부딪|낙하|떨어져|맞)/.test(
      text
    ) || /(충돌|부딪|맞아|가격)/.test(text);

  if (objectStrike) {
    add("충돌 및 접촉");
  }

  if (/추락|아래로 떨어|발을 헛디|개구부/.test(text)) {
    add("떨어짐");
  }

  if (
    /넘어져|넘어짐|걸려 넘어|미끄러/.test(text) &&
    !/추락|아래로 떨어/.test(text)
  ) {
    add("넘어짐");
  }

  if (
    /유해물질|분진|석면|호흡기|흡입|질환/.test(text) &&
    !risks.includes("질식")
  ) {
    add("질병");
  }

  return {
    risks,
    source: risks.length > 0 ? "keyword_suggestion" : "unresolved",
    confidence:
      risks.length === 1 ? "medium" : risks.length > 1 ? "low" : "none",
  };
}

module.exports = { inferExpectedRiskTypes };
