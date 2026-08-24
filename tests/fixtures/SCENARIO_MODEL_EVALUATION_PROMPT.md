# 다른 AI 모델용 독립 위험 시나리오 선택 지시문

## 목적

SAFER의 현재 선택 결과를 보지 않고, 작업자 상황과 237개 실제 사고 시나리오 중 허용된 후보만 이용해 가장 적합한 시나리오를 독립적으로 선택합니다.

입력 파일은 `ai_selector_packet_a.json`입니다. 재현성·순서 민감도 확인을 수행할 때는 동일한 지시문으로 `ai_selector_packet_b.json`도 별도 실행합니다. A와 B 결과를 한 대화 안에서 동시에 만들지 마세요.

## 판단 기준

각 사례에서 다음 기준을 순서대로 종합합니다.

1. 대공정은 입력과 반드시 일치해야 합니다.
2. 세부공정과 실제 작업 내용이 직접적으로 일치하는 후보를 우선합니다.
   선택한 모든 후보의 `detail_process`는 최종 `prediction.detail_process`와 반드시 정확히 같아야 하며, 서로 다른 세부공정 후보를 혼합하지 않습니다.
3. 사고유형, 위험요인, 발생 메커니즘이 예상 결과와 일치해야 합니다.
4. 저해요인·작업자 역할은 위험 발생 가능성을 해석하는 보조 근거로만 사용합니다.
5. 단순한 단어 중복보다 사고가 발생하는 인과 흐름의 일치를 우선합니다.
6. 적합한 후보가 없으면 억지로 3개를 채우지 말고 빈 배열 또는 1~2개만 반환합니다.

## 편향 방지 규칙

- 입력 후보의 제시 순서는 품질 순위가 아닙니다.
- 참가자 이름·소속·가족 정보는 판단에 사용하지 않습니다.
- SAFER 현재 선택기의 결과나 모델 이름을 추측하지 않습니다.
- 후보에 없는 시나리오 ID와 사고 사실을 만들지 않습니다.
- 각 후보를 먼저 독립 채점한 뒤 최종 순위를 정합니다.

## 출력 형식

JSON 이외의 설명은 출력하지 마세요.

```json
{
  "schema_version": "2.0",
  "model": "정확한 모델명과 버전",
  "run_metadata": {
    "provider": "제공사",
    "run_id": "직접 정한 고유 실행 ID",
    "packet_order": "A",
    "temperature": 0,
    "prompt_version": "scenario-independent-ranking-v2",
    "run_date": "YYYY-MM-DD"
  },
  "cases": [
    {
      "case_id": "CASE_01",
      "prediction": {
        "detail_process": "가설공사",
        "candidate_scenario_ids": [105, 106, 110],
        "candidate_risk_types": ["떨어짐", "떨어짐", "끼임"]
      },
      "candidate_assessments": [
        {
          "scenario_id": 105,
          "relevance_score": 5,
          "reason": "작업·위험요인·사고 메커니즘이 직접 일치"
        }
      ],
      "rationale": "최종 순위 선정 근거",
      "needs_human_review": false
    }
  ]
}
```

## 출력 검증

- 입력의 모든 `case_id`가 정확히 한 번씩 포함되어야 합니다.
- `candidate_scenario_ids`는 각 사례의 `eligible_candidates`에 존재해야 합니다.
- 선택한 모든 후보의 `detail_process`는 `prediction.detail_process`와 정확히 같아야 합니다.
- `candidate_risk_types`는 선택한 후보의 `primary_risk_type`과 순서대로 같아야 합니다.
- `relevance_score`는 1~5 정수입니다.
- 결과가 불명확하면 `needs_human_review: true`로 표시합니다.
