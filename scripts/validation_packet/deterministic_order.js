const crypto = require("crypto");

function hashNumber(text) {
  const hex = crypto
    .createHash("sha256")
    .update(String(text))
    .digest("hex")
    .slice(0, 8);
  return Number.parseInt(hex, 16);
}

function deterministicShuffle(values, seedText) {
  // 후보 위치의 order bias를 통제하면서 재현 가능하도록 seed 기반 순서를 고정한다.
  return [...values].sort((left, right) => {
    const leftHash = hashNumber(`${seedText}:${left.scenario_id}`);
    const rightHash = hashNumber(`${seedText}:${right.scenario_id}`);
    return leftHash - rightHash;
  });
}

module.exports = { deterministicShuffle };
