const EXACT_RISK_TYPES = new Set([
  "떨어짐",
  "끼임",
  "충돌 및 접촉",
  "깔림",
  "감전",
  "절상",
  "화상",
  "질병",
  "질식",
  "넘어짐",
  "미끄러짐",
  "익사",
  "복합/불명확"
]);

const RISK_ALIASES = [
  [["추락", "떨어짐"], "떨어짐"],
  [["협착", "끼임"], "끼임"],
  [["낙하", "비래", "맞음", "충돌", "부딪힘"], "충돌 및 접촉"],
  [["깔림"], "깔림"],
  [["붕괴", "전도", "무너짐", "도괴"], "붕괴/전도"],
  [["화상", "화재"], "화상"],
  [["감전"], "감전"],
  [["절상", "절단", "찔림", "베임"], "절상"],
  [["질병"], "질병"],
  [["질식"], "질식"],
  [["미끄러짐"], "미끄러짐"],
  [["넘어짐"], "넘어짐"],
  [["익사", "빠짐"], "익사"]
];

function normalizeRiskType(riskType) {
  if (!riskType || riskType === "undefined") return "미분류";
  const value = String(riskType).trim();
  if (EXACT_RISK_TYPES.has(value)) return value;

  for (const [aliases, normalized] of RISK_ALIASES) {
    if (aliases.some(alias => value.includes(alias))) return normalized;
  }
  return "미분류";
}

module.exports = { normalizeRiskType };
