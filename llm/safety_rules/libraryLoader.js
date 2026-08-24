// import 시 한 번만 load해야 기존 side effect와 fallback 시점을 유지한다.
const fs = require("fs");
const path = require("path");

function collectMeasureEntries(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach(item => collectMeasureEntries(item, out));
    return out;
  }
  if (typeof node === "object") {
    const looksLikeEntry =
      node.measures || node.actions || node.rules || node.scenarioLinkedAction ||
      node.scenario_linked_action || node["AI 정제 대책 1"] || node["AI 문장 대책 1"] ||
      node["원본행번호"] || node.scenario || node.sentence || node["유해위험요인"];
    if (looksLikeEntry) {
      out.push(node);
      return out;
    }
    Object.values(node).forEach(value => collectMeasureEntries(value, out));
  }
  return out;
}

function loadMeasureLibrary() {
  const refDir = path.join(__dirname, "..", "..", "reference_data");
  const candidates = [
    "measure_library.json",
    "scenario_measure_library.json",
    "safety_measure_library.json",
    "감소대책_시나리오연결_전체.json",
    "감소대책_시나리오연결_파일럿_30건.json"
  ];

  for (const filename of candidates) {
    const fullPath = path.join(refDir, filename);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const entries = collectMeasureEntries(JSON.parse(fs.readFileSync(fullPath, "utf8")), []);
      console.log(`✅ 감소대책 라이브러리 로드 완료: ${filename} (${entries.length}개 entry)`);
      return entries;
    } catch (e) {
      console.warn(`⚠️ 감소대책 라이브러리 로드 실패: ${filename}`, e.message);
    }
  }

  console.warn("⚠️ 감소대책 라이브러리 JSON을 찾지 못했습니다. C1/C2/C3 안전수칙은 fallback으로 생성됩니다.");
  return [];
}

module.exports = { collectMeasureEntries, loadMeasureLibrary };
