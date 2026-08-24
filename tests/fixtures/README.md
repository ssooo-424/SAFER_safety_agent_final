# Scenario matching fixtures

반복 검증에 사용하는 입력 JSON을 이 폴더에 둡니다.

권장 파일명:

```text
tests/fixtures/model_test_cases_30.json
```

실행:

```powershell
node scripts/evaluateScenarioMatching.js tests/fixtures/model_test_cases_30.json --model current_index_selector
```

프로젝트 밖의 파일도 바로 실행할 수 있습니다.

```powershell
node scripts/evaluateScenarioMatching.js "C:\Users\ssooo\Downloads\model_test_cases_30.json"
```

기준선 결과는 `results/scenario_matching/`에 생성됩니다.

- `current_index_selector_results.json`: 현재 INDEX 후보 선택 결과와 잠정 평가
- `gold_labels_template.json`: 사람 또는 별도 AI가 확정할 정답 라벨 템플릿

연구용 검증 파일을 준비하려면 다음을 실행합니다.

```powershell
node scripts/prepareScenarioValidation.js --input tests/fixtures/model_test_cases_30.json --result results/scenario_matching/current_index_selector_results.json
```

생성되는 주요 파일:

- `results/scenario_validation/ai_selector_packet_a.json`: 다른 AI의 독립 선택용 입력
- `results/scenario_validation/ai_selector_packet_b.json`: 후보 순서 민감도 확인용 입력
- `results/scenario_validation/human_review_bundle.json`: 사람 검토 화면용 번들
- `results/scenario_validation/reviewer_template.json`: 검토 출력 스키마 참고용

전체 절차와 연구 지표는 `docs/SCENARIO_VALIDATION_PROTOCOL.md`를 따릅니다.
