const STANDARDIZED_ORGANIZATIONAL_OUTCOME = Object.freeze({
  source: "standardized_experimental",
  severityTier: "serious",
  workStopDuration: "3일",
  scheduleDelay: "3일",
  interviewedPeople: 6,
  reviewedRecords: Object.freeze([
    "작업계획서",
    "위험성평가서",
    "안전교육 기록",
    "작업 전 점검 기록"
  ]),
  internalDepartments: Object.freeze([
    "회사 안전보건 부서",
    "생산·현장관리 부서"
  ]),
  externalAgencies: Object.freeze([
    "관할 지방고용노동관서",
    "경찰"
  ]),
  correctiveActions: Object.freeze([
    "안전시설 보완",
    "작업방법 변경",
    "추가 안전교육"
  ])
});

function buildStandardizedOrganizationalOutcomeMessages(condition = "educator") {
  if (condition === "coworker") {
    return [
      "사고가 난 뒤 내가 하던 관련 작업은 3일 동안 멈췄어. 회사 안전보건 부서와 생산·현장관리 부서에서 나와 당시 함께 일하던 작업자, 관리자까지 6명에게 사고 경위를 물었어. 작업계획서와 위험성평가서, 안전교육 기록, 작업 전 점검 기록도 다시 확인했어.",
      "관할 지방고용노동관서와 경찰에서도 현장조사를 나왔어. 안전시설을 보완하고 작업방법을 바꾼 뒤 추가 안전교육까지 마치고 나서야 작업을 다시 시작했어. 작업 일정도 3일 밀렸고, 같이 일하던 사람들의 부담까지 커지는 걸 보니까 마음이 무거웠어."
    ];
  }

  if (condition === "future_self") {
    return [
      "내 사고가 난 뒤 관련 작업은 3일 동안 멈췄어. 회사 안전보건 부서와 생산·현장관리 부서는 나와 당시 함께 일하던 작업자, 관리자 6명에게 사고 경위를 확인했어. 작업계획서와 위험성평가서, 안전교육 기록, 작업 전 점검 기록도 다시 조사했어.",
      "관할 지방고용노동관서와 경찰의 현장조사까지 이어졌어. 회사는 안전시설을 보완하고 작업방법을 바꾼 뒤 추가 안전교육을 실시했어. 작업 일정도 3일 밀렸고, 내 사고가 동료와 관리자, 현장 전체에 부담을 남겼다는 사실이 오래 마음에 남았어."
    ];
  }

  return [
    "이 사고 이후 관련 작업은 3일 동안 중단되었습니다. 회사 안전보건 부서와 생산·현장관리 부서는 사고 당시 함께 작업한 작업자와 관리자 6명을 대상으로 사고 경위를 확인했습니다. 작업계획서, 위험성평가서, 안전교육 기록, 작업 전 점검 기록도 함께 검토했습니다.",
    "관할 지방고용노동관서와 경찰의 현장조사도 진행되었습니다. 회사는 안전시설을 보완하고 작업방법을 변경했으며, 추가 안전교육을 실시한 뒤 작업을 재개했습니다. 그 과정에서 작업 일정도 3일 지연되었습니다."
  ];
}

module.exports = {
  STANDARDIZED_ORGANIZATIONAL_OUTCOME,
  buildStandardizedOrganizationalOutcomeMessages
};
