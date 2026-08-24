# SAFER 위험 시나리오 매칭 검증 protocol

## 1. 검증 대상

검증 대상은 agent의 말투가 아니라, INDEX 입력 상황에서 237개 실제 사고 시나리오 중 적절한 후보를 선택하는 기능입니다. 평가 단위는 다음 세 가지입니다.

1. 세부공정 분류
2. 대표 사고유형 분류
3. Top-3 후보의 내용과 순위

현재 INDEX 선택기는 세부공정 후보에서 서로 다른 대표 사고유형을 앞에서부터 최대 3개 고르는 deterministic baseline입니다. 따라서 baseline 결과 자체를 정답으로 사용하지 않습니다.

시나리오 원자료는 [`reference_data/risk_assessment_with_scenarios.xlsx`](../reference_data/risk_assessment_with_scenarios.xlsx)에서 [`reference_data/scenarios.json`](../reference_data/scenarios.json)으로 변환됩니다. 테스트 입력과 review 결과는 participant 연구자료이므로 repository에 포함하지 않고 별도로 관리합니다. 입력 경로는 각 script의 `--input` 또는 positional argument로 지정합니다.

## 2. 권장 연구 설계

### 독립 AI 선택

독립 AI에는 현재 INDEX 결과를 보여주지 않습니다. 작업상황과 해당 대공정의 허용 후보만 제공해 독립적으로 Top-3를 선택합니다. 후보 순서 편향을 확인하려면 순서를 바꾼 packet A와 B를 별도 대화에서 실행합니다.

LLM 평가에는 위치 편향, 장황성 편향과 자기선호 편향이 보고되어 있으므로 사람 정답의 대체물이 아니라 보조 검증으로 사용합니다.

참고: Zheng et al. (2023), Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. [NeurIPS paper](https://papers.neurips.cc/paper_files/paper/2023/hash/91f18a1287b398d378ef22505bf41832-Abstract-Datasets_and_Benchmarks.html)

### 사람 검토

테스트 사례 30건 전체를 두 명이 독립 검토하는 것을 권장합니다.

- 평가자 1: 건설안전·산업안전 내용을 판단할 수 있는 사람
- 평가자 2: 같은 기준을 교육받은 연구자 또는 두 번째 안전 전문가
- 서로의 결과와 model명을 보지 않고 평가
- 본 평가 전에 별도 3~5개 연습 사례로 기준을 맞춘 뒤 지침을 고정
- 두 평가가 끝난 뒤에만 불일치를 합의하거나 제3자가 판정

한 사람이 두 번 평가하면 평가자 내 재검사 일관성은 확인할 수 있지만 독립 평가자 간 신뢰도를 대신할 수 없습니다.

### 후보 pooling

사람은 매 사례마다 237개를 모두 읽지 않고, 비교할 모든 system의 Top-3 합집합을 익명으로 평가합니다. 후보마다 적합도 1~5점, 수용 가능 여부, 가장 적합한 후보 1개와 선택·제외 이유를 기록합니다.

| 점수 | 의미 |
| --- | --- |
| 1 | 작업·위험·사고 mechanism이 무관함 |
| 2 | 일부 단어만 비슷하고 핵심 흐름이 다름 |
| 3 | 가능성은 있으나 더 적합한 후보가 있음 |
| 4 | 작업상황과 위험 mechanism이 적합함 |
| 5 | 작업·사고유형·위험요인·발생 흐름이 직접 일치함 |

## 3. 신뢰성 및 검색 지표

### 평가자 간 신뢰도

- 단순 일치율: 같은 판단의 비율
- Cohen's kappa: 우연 일치를 보정한 범주형 일치도
- 가중 Cohen's kappa: 순서형 점수의 차이를 반영한 일치도
- Jaccard: 두 평가자가 수용한 scenario set의 겹침
- 95% bootstrap 신뢰구간: 30건 재표집에 따른 불확실성

Cohen의 원 논문: [Cohen (1960)](https://doi.org/10.1177/001316446002000104)

가중 kappa 원 논문: [Cicchetti and Allison (1971)](https://pubmed.ncbi.nlm.nih.gov/19673146/)

여러 평가자·결측치까지 확장할 때는 [Hayes and Krippendorff (2007)](https://doi.org/10.1080/19312450709336664)의 Krippendorff's alpha를 사용할 수 있습니다.

프로젝트 기준은 연구 결과를 보기 전에 선언합니다. 보편적인 절대 기준으로 해석하지 않습니다.

- 최소 기준: 단순 일치율 0.80 이상이고 kappa 0.60 이상
- 권장 목표: kappa 0.75 이상
- 기준 미달: 지침을 수정하고 독립 재평가

kappa가 범주 분포에 영향을 받을 수 있으므로 단순 일치율과 함께 보고합니다.

### 시나리오 검색 성능

- Hit@3: Top-3 안에 수용 가능한 시나리오가 하나라도 있는 비율
- Precision@3: 제시한 후보 중 수용 가능한 후보의 비율
- Recall@3: 수용 가능한 후보 중 Top-3가 회수한 비율
- MRR@3: 첫 수용 후보가 앞 순위일수록 높은 값
- nDCG@3: 1~5점 적합도를 반영한 순위 품질

nDCG 근거: Järvelin & Kekäläinen (2002), Cumulated Gain-based Evaluation of IR Techniques. [ACM paper](https://doi.org/10.1145/582415.582418)

두 system의 Hit@3은 같은 30건에서 비교하므로 독립표본 검정이 아니라 exact McNemar paired test를 사용합니다. p값만 제시하지 말고 원시 적중 수와 효과 차이도 함께 보고합니다.

## 4. 실행 순서

아래 명령의 `tests/fixtures/model_test_cases_30.json`과 `results/` 아래 파일은 실행자가 준비하는 local 또는 비공개 연구자료입니다. 기본 경로는 script에 정의되어 있지만 repository에 포함된다고 가정하지 않습니다.

### 1단계: 현재 INDEX baseline 생성

```bash
node scripts/evaluateScenarioMatching.js tests/fixtures/model_test_cases_30.json --model current_index_selector
```

결과는 기본적으로 `results/scenario_matching/current_index_selector_results.json`에 기록됩니다. 다른 출력 위치는 `--output-dir`로 지정합니다.

### 2단계: AI·사람 review bundle 생성

```bash
node scripts/prepareScenarioValidation.js \
  --input tests/fixtures/model_test_cases_30.json \
  --result results/scenario_matching/current_index_selector_results.json
```

기본 생성 파일은 `results/scenario_validation/ai_selector_packet_a.json`, `ai_selector_packet_b.json`, `human_review_bundle.json`, `reviewer_template.json`입니다. 별도 AI에는 `tests/fixtures/SCENARIO_MODEL_EVALUATION_PROMPT.md`와 packet을 제공합니다.

다른 AI 결과를 추가할 때는 `--result`를 반복합니다.

```bash
node scripts/prepareScenarioValidation.js \
  --input tests/fixtures/model_test_cases_30.json \
  --result results/scenario_matching/current_index_selector_results.json \
  --result results/scenario_matching/other_model_run_a_results.json
```

### 3단계: 두 평가자의 독립 검토

서버를 실행하고 `http://localhost:3001/scenario-review.html`을 엽니다. 평가자마다 서로 다른 ID를 사용해 30건을 완료하고 JSON을 export합니다. 서로의 결과를 먼저 공유하지 않습니다.

Local 검증에서 `public/research/scenario_validation_bundle.json`을 두면 review 화면이 기본 bundle을 자동 load합니다. 파일이 없으면 화면의 `검토 bundle 불러오기`로 선택합니다. 이 경로의 연구 output은 Git에 추가하지 않습니다.

### 4단계: 평가자 간 일치도 계산

```bash
node scripts/analyzeScenarioReviewerAgreement.js \
  results/scenario_validation/scenario_review_R1.json \
  results/scenario_validation/scenario_review_R2.json
```

기본 생성 파일은 `reviewer_agreement.json`과 `adjudication_template.json`입니다. 불일치가 있으면 `http://localhost:3001/scenario-adjudication.html`에서 조정하고 `status=confirmed`인 gold 파일을 export합니다.

`public/research/scenario_validation_bundle.json`과 `public/research/adjudication_template.json`이 있으면 adjudication 화면이 두 파일을 자동 load하고, 없으면 각 file control을 사용합니다.

### 5단계: 최종 연구 지표 계산

```bash
node scripts/evaluateScenarioResearchMetrics.js \
  results/scenario_matching/current_index_selector_results.json \
  results/scenario_matching/other_model_run_a_results.json \
  --gold results/scenario_validation/scenario_gold_adjudicated.json
```

`--output`을 지정하지 않으면 `results/scenario_validation/research_metrics.json`에 저장됩니다. draft gold를 사용하려면 script가 명시적으로 허용하도록 `--allow-draft`를 지정해야 합니다.

## 5. 보고서에 기록할 항목

- 237개 시나리오의 출처와 분류 방법
- 30개 테스트 사례의 생성 방법과 포함 범위
- 평가자 수, 자격, 교육 방법, 독립·익명 평가 여부
- AI model명·version·실행일·temperature·prompt version
- 후보 pooling 방법과 미평가 후보 처리 원칙
- 단순 일치율, kappa·가중 kappa, Jaccard
- Hit@3, Precision@3, Recall@3, MRR@3, nDCG@3
- 핵심 지표의 95% bootstrap 신뢰구간
- 불일치 합의 방법과 제외 사례
- 작은 표본과 AI 판단 편향이라는 한계
