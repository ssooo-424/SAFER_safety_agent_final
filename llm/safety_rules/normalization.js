// matching과 deduplication이 같은 canonical form을 공유하도록 경계를 한곳에 둔다.
function normalizeRiskType(rt) {
  if (!rt || rt === "undefined") return "기타";

  const s = String(rt);
  if (s.includes("추락") || s.includes("떨어짐")) return "추락";
  if (s.includes("협착") || s.includes("끼임")) return "끼임";
  if (s.includes("낙하") || s.includes("비래") || s.includes("맞음")) return "낙하";
  if (s.includes("충돌") || s.includes("부딪힘")) return "충돌";
  if (s.includes("붕괴") || s.includes("전도") || s.includes("무너짐") || s.includes("깔림")) return "붕괴";
  if (s.includes("감전") || s.includes("화재") || s.includes("화상")) return "감전";
  if (s.includes("질식")) return "질식";
  if (s.includes("익사") || s.includes("빠짐")) return "익사";
  if (s.includes("절상") || s.includes("절단") || s.includes("베임") || s.includes("찔림")) return "절상";
  if (s.includes("넘어짐") || s.includes("미끄러짐")) return "넘어짐";
  return "기타";
}

function normalizeText(s = "") {
  return String(s).replace(/\s+/g, "").replace(/[“”"']/g, "").trim();
}

function cleanRuleAction(s = "") {
  return String(s)
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*$/, "")
    .trim();
}

module.exports = { normalizeRiskType, normalizeText, cleanRuleAction };
