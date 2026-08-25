const DEFAULT_RELATIONSHIP = "가족";

const RELATIONSHIP_NARRATIVES = Object.freeze({
  "가족": {
    coworker: "사고 뒤 치료가 길어지면서 가족도 걱정이 많아졌고, 내 치료와 일상을 챙기느라 부담을 함께 떠안았어.",
    futureSelf: "몸보다 더 괴로운 건 가족이 내 아픈 모습과 치료 과정을 함께 감당해야 했던 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 가족의 일상까지 무너졌어. 마지막 인사도 못 하고 모든 부담을 남겨서 너무 미안해."
  },
  "아들": {
    coworker: "사고 뒤 치료가 길어지면서 아들과 예전처럼 시간을 보내거나 잘 놀아주기 어려웠어.",
    futureSelf: "몸보다 더 괴로운 건 아들과 예전처럼 시간을 보내거나 잘 놀아주기 어려워진 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 아들과 함께할 평범한 시간도 모두 멈춰버렸어."
  },
  "딸": {
    coworker: "사고 뒤 치료가 길어지면서 딸과 예전처럼 시간을 보내거나 잘 놀아주기 어려웠어.",
    futureSelf: "몸보다 더 괴로운 건 딸과 예전처럼 시간을 보내거나 잘 놀아주기 어려워진 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 딸과 함께할 평범한 시간도 모두 멈춰버렸어."
  },
  "배우자": {
    coworker: "사고 뒤 치료가 길어지면서 배우자도 걱정이 많아졌고, 내 치료와 일상을 챙기느라 부담을 함께 떠안았어.",
    futureSelf: "몸보다 더 괴로운 건 배우자가 내 아픈 모습과 치료 과정을 함께 감당해야 했던 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 배우자가 모든 부담을 혼자 감당하게 된 게 너무 미안해."
  },
  "부모님": {
    coworker: "사고 뒤 치료가 길어지면서 부모님이 내 상태를 많이 걱정하셨고, 회복 과정을 함께 감당하셨어.",
    futureSelf: "몸보다 더 괴로운 건 부모님이 내 상태를 걱정하며 회복 과정을 함께 감당해야 했던 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 부모님께 너무 큰 슬픔과 부담을 남긴 것 같아."
  },
  "연인": {
    coworker: "사고 뒤 치료가 길어지면서 연인도 내 치료와 회복 과정을 곁에서 함께 감당해야 했어.",
    futureSelf: "몸보다 더 괴로운 건 연인이 내 아픈 모습과 회복 과정을 함께 감당해야 했던 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 연인에게 너무 큰 슬픔과 부담을 남긴 것 같아."
  },
  "친구": {
    coworker: "사고 뒤 치료가 길어지면서 친구들과 예전처럼 편하게 만나거나 연락하기 어려웠어.",
    futureSelf: "몸보다 더 괴로운 건 친구들과 예전처럼 편하게 만나던 일상도 잃어버린 거야.",
    futureSelfFatal: "내가 돌아오지 못한 뒤 친구들과 함께하던 평범한 시간도 모두 멈춰버렸어."
  },
  "나 자신": {
    coworker: "사고 뒤 치료가 길어지면서 내 일상과 내가 해오던 일을 스스로 감당하기 어려웠어.",
    futureSelf: "몸보다 더 괴로운 건 내 일상과 내가 해오던 일을 스스로 감당하기 어려워진 거야.",
    futureSelfFatal: "그날 이후 내가 해오던 일상과 앞으로의 삶이 모두 멈춰버렸어."
  }
});

function getRelationshipNarrative(relationship) {
  const normalized = String(relationship || "").trim();
  return RELATIONSHIP_NARRATIVES[normalized] || RELATIONSHIP_NARRATIVES[DEFAULT_RELATIONSHIP];
}

function normalizeRelationship(relationship) {
  const normalized = String(relationship || "").trim();
  return RELATIONSHIP_NARRATIVES[normalized] ? normalized : DEFAULT_RELATIONSHIP;
}

module.exports = {
  DEFAULT_RELATIONSHIP,
  RELATIONSHIP_NARRATIVES,
  getRelationshipNarrative,
  normalizeRelationship
};
