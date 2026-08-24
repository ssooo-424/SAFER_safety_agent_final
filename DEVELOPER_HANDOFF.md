# SAFER 개발자 인수인계

## 프로젝트 개요

SAFER(Safety Agent Framework for Experimental Roles)는 건설현장 작업자가 작업 상황에 맞는 실제 사고 시나리오를 선택하고, 세 가지 사회적 역할의 AI와 안전대화를 진행하는 연구용 web prototype입니다.

세 condition은 다음과 같습니다.

| condition | 역할 |
| --- | --- |
| `educator` | 전문적이고 객관적인 AI 안전교육자 |
| `coworker` | 같은 현장에서 일하는 동료 작업자 AI |
| `future_self` | 사고를 겪은 미래의 자신이 현재의 자신에게 말하는 AI |

선택한 사고 사실, 세 가지 핵심 안전수칙, Turn 0~6의 순서는 condition 간에 같습니다. 차이는 agent의 관계, 말투와 framing입니다.

## 참여자 흐름

1. `/`에서 사전설문과 작업 상황을 입력합니다.
2. `GET /api/scenarios?major=...&detail=...`로 받은 후보 중 한 사고 시나리오를 선택합니다. 서버는 선택한 `scenarioRowId`를 세션에 저장합니다.
3. `POST /api/submit`이 서버 발급 `sessionId`, `participantId`, condition과 `HttpOnly` `safer_session` cookie를 만듭니다.
4. `/safer`에서 `POST /api/safer-start`, `POST /api/safer-intro`, `POST /api/safer-chat`을 통해 Turn 0~6을 진행합니다.
5. Turn 4에서 예방 행동을 입력합니다. `SpeechRecognition`이 지원되면 선택적으로 음성 입력을 사용할 수 있고, 서버는 Turn 5 요청에 최종 text와 `inputMethod`를 저장합니다.
6. Turn 6에서 세 가지 수칙 중 가장 자신 있는 수칙을 고른 뒤 `/post-survey.html`로 이동합니다.

참여자 요청의 권한 정보는 client payload가 아니라 `safer_session` cookie의 server session에서 읽습니다. 참여자가 보낸 참여자 ID, condition, scenario ID는 권한 정보로 사용하지 않습니다.

## 사고 시나리오와 안전수칙

현재 runtime scenario pool은 [`reference_data/scenarios.json`](reference_data/scenarios.json)의 237개 항목이며, 생성 입력과 변환기는 [`reference_data/risk_assessment_with_scenarios.xlsx`](reference_data/risk_assessment_with_scenarios.xlsx)와 [`scripts/scenario_to_json.py`](scripts/scenario_to_json.py)에 있습니다. 분류 교정 14건은 [`reference_data/scenario_classification_overrides.json`](reference_data/scenario_classification_overrides.json)에 있습니다.

[`runtime/scenarioCatalog.js`](runtime/scenarioCatalog.js)는 대공정·세부공정별 후보를 최대 3개 반환합니다. 선택된 항목의 `id`를 대화 전체에서 고정하고, [`runtime/safetyCaseService.js`](runtime/safetyCaseService.js)가 선택 사고와 안전수칙을 `SafetyCase`로 결합합니다.

안전수칙 선택의 외부 facade는 [`llm/safetyRulesEngine.js`](llm/safetyRulesEngine.js)이고 실제 loading·matching·selection은 [`llm/safety_rules/`](llm/safety_rules/)에 있습니다. 결과는 작업자가 실행할 수 있는 문장으로 정리하며, `SafetyCase`에는 정확히 세 개의 `safety_rules`를 넣습니다. LLM은 이 근거 데이터를 새로 만들지 않고 정해진 Turn의 표현을 생성합니다.

## 대화 구조

| Turn | 동작 | 생성 |
| --- | --- | --- |
| 0 | agent 인사와 역할 소개 | deterministic |
| 1 | 작업 상황과 사고 상황 연결 | `safer-intro` LLM script |
| 2 | 사고 원인 설명 | `safer-intro` LLM script |
| 3 | 사고 결과와 반응 | `safer-intro`와 condition별 extension |
| 4 | 예방 행동 입력 질문 | deterministic |
| 5 | 입력한 행동과 세 안전수칙 비교 | LLM evaluation + deterministic feedback |
| 6 | 세 안전수칙 제시 | deterministic |

`future_self`의 결과 서사는 participant context와 `importantPerson` 등을 사용하지만, 선택된 사고 사실과 안전수칙을 바꾸면 안 됩니다. 강한 공포·죄책감 표현은 연구 조작에 해당하므로 연구윤리 검토와 불편감·반발 측정을 함께 확인합니다.

## 코드 위치

| 영역 | 경로 |
| --- | --- |
| Express composition과 startup | [`server.js`](server.js) |
| route와 session service | [`runtime/`](runtime/) |
| memory/Postgres store와 request lease | [`lib/`](lib/) |
| condition prompt와 agent | [`llm/saferPrompts.js`](llm/saferPrompts.js), [`llm/safer_agents/`](llm/safer_agents/) |
| safety rule facade와 내부 모듈 | [`llm/safetyRulesEngine.js`](llm/safetyRulesEngine.js), [`llm/safety_rules/`](llm/safety_rules/) |
| participant UI | [`public/index.html`](public/index.html), [`public/safer.html`](public/safer.html), [`public/post-survey.html`](public/post-survey.html) |
| scenario review UI | [`public/scenario-review.html`](public/scenario-review.html), [`public/scenario-adjudication.html`](public/scenario-adjudication.html) |
| scenario와 safety measure data | [`reference_data/`](reference_data/) |

## API

| Method | 경로 | 역할 |
| --- | --- | --- |
| `GET` | `/api/scenarios` | `major`, `detail`에 맞는 최대 3개 후보 반환 |
| `POST` | `/api/submit` | 사전설문과 scenario 선택 저장, session cookie 발급 |
| `POST` | `/api/safer-start` | 세션의 사고와 condition으로 `SafetyCase`·Turn 0 생성 |
| `POST` | `/api/safer-intro` | Turn 1~3 script 생성 |
| `POST` | `/api/safer-chat` | Turn 4~6 처리 |
| `POST` | `/api/submit-post-survey` | 세션에 연결된 사후설문 저장 |
| `GET` | `/api/health` | store, condition assignment, credentials, timing, limits 확인 |

`GET /api/last-survey`와 이전 공개 write·LLM 경로는 현재 HTTP 410으로 비활성화되어 있습니다. 참여자 흐름에서 사용하지 않습니다.

## 저장소와 배정

- `DATABASE_URL`이 있으면 `PostgresExperimentStore`가 session, participant ID, scenario, condition, 대화 상태와 request 상태를 저장합니다.
- `DATABASE_URL`이 없으면 `MemoryExperimentStore`를 사용하며 process 종료 시 데이터가 사라집니다.
- `FIXED_CONDITION`은 `educator`, `coworker`, `future_self`만 허용합니다. 미설정 시 [`lib/conditionAssignment.js`](lib/conditionAssignment.js)가 현재 최소 세션 수 condition 중 하나를 선택합니다.
- `SAFER_DATA_DIR`를 명시하면 local 검증에서만 `data/<participantId>.json`과 `survey/<participantId>.json` 호환 export를 생성합니다. 현장 Render 서비스에서는 Postgres만 원본으로 사용합니다.
- `npm run export:google-sheets`는 `phase=completed` session을 Postgres에서 읽어 Google Sheet의 `participant_id` 행을 upsert합니다. participant route에서는 Sheets를 호출하지 않으며 `session_id`도 export하지 않습니다.
- session cookie는 `HttpOnly`, `SameSite=Lax`이고 HTTPS 요청에서는 `Secure`입니다. `server.js`는 proxy를 신뢰하도록 설정합니다.

요청은 UUID `X-Request-Id`로 멱등성을 유지합니다. 같은 ID의 완료 응답은 재사용되고, lease가 만료된 요청은 `leaseGeneration`으로 이전 worker가 새 결과를 덮어쓰지 못합니다. 사전설문과 LLM 요청에는 IP별·전체 fixed-window rate limit이 있고 LLM에는 동시 실행 한도가 있습니다.

## 로컬 실행과 현장 전 준비

```bash
npm ci
cp .env.example .env
npm start
```

필수 변수는 [`.env.example`](.env.example)에 있습니다. 현장에서는 `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATABASE_URL`, `NODE_ENV=production`을 Render 환경변수에 설정하고, `PORT`는 Render 값을 사용합니다.

`REQUEST_LEASE_MS`의 허용 최솟값은 다음과 같습니다.

```text
max(120000, OPENAI_TIMEOUT_MS × (OPENAI_MAX_RETRIES + 1) + 30000)
```

기본값은 `OPENAI_TIMEOUT_MS=30000`, `OPENAI_MAX_RETRIES=0`, `REQUEST_LEASE_MS=120000`입니다. 기본 rate limit은 10분 창에서 submit이 IP별 30·전체 120, LLM이 IP별 60·전체 240, 동시 LLM 12입니다. 실제 참여자 수와 네트워크 조건으로 concurrent rehearsal을 수행한 뒤 조정합니다.

검증할 항목은 다음과 같습니다.

- `GET /api/health`에서 Postgres 사용 시 `store.kind=postgres`, `store.durable=true`, `credentials.database=true`인지 확인합니다.
- 고정 condition service는 `assignmentMode=fixed`, 통합 service는 `assignmentMode=balanced`인지 확인합니다.
- 여러 tablet에서 사전설문부터 Turn 6과 사후설문까지 진행하고, 네트워크를 끊었다가 같은 버튼으로 재시도합니다.
- 실제 Galaxy tablet에서 Korean `SpeechRecognition`, microphone permission, browser `speechSynthesis`를 확인합니다.

현장 절차는 [`docs/FIELD_DEPLOYMENT.md`](docs/FIELD_DEPLOYMENT.md)를 따릅니다.

Google Sheets export에는 `GOOGLE_SHEETS_URL`, 선택적 `GOOGLE_SHEETS_TAB`, Service Account credential이 필요합니다. Render에서는 JSON key를 secret file로 저장하고 `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/google-service-account.json`을 사용합니다. 대상 Sheet는 Service Account email에 `Editor`로 공유합니다. 개인 Google password는 사용하지 않습니다.

## 시나리오 검증

시나리오 후보 선택은 agent 대화 품질과 별도로 검증합니다. 상세 연구 설계와 지표는 [`docs/SCENARIO_VALIDATION_PROTOCOL.md`](docs/SCENARIO_VALIDATION_PROTOCOL.md)를 참조합니다.

검증 도구는 다음과 같습니다.

- `scripts/evaluateScenarioMatching.js`: 현재 INDEX 선택기 평가
- `scripts/prepareScenarioValidation.js`: 익명 review bundle 생성
- `scripts/analyzeScenarioReviewerAgreement.js`: 두 reviewer의 일치도 계산
- `scripts/evaluateScenarioResearchMetrics.js`: Hit@3, MRR@3, nDCG@3 등 연구 지표 계산
- `/scenario-review.html`: 사람 검토
- `/scenario-adjudication.html`: 불일치 조정

## 불변 조건

- 세 condition은 같은 사고 사실과 세 가지 핵심 안전수칙을 사용합니다.
- participant가 선택한 하나의 scenario를 대화 종료까지 유지합니다.
- 근거 data에 없는 사고 사실을 prompt에 추가하지 않습니다.
- `scenario_classification_overrides.json`의 내부 검토용 `reason`을 participant에게 노출하지 않습니다.
- 개인정보, 설문 응답, 대화 로그와 API key를 repository에 저장하지 않습니다.
