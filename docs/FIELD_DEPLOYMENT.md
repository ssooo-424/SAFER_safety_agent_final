# SAFER 현장 배포 및 운영

이 문서는 Render Web Service, Render Postgres와 여러 tablet으로 현장 실험을 운영할 때 필요한 설정과 점검 절차를 정리합니다. 실험 데이터의 source of record는 Render Postgres입니다.

## Render 설정

1. Web Service와 같은 region에 Render Postgres를 만들고, `DATABASE_URL`에는 Postgres의 **Internal Database URL**을 등록합니다. [Render PostgreSQL 연결 문서](https://render.com/docs/postgresql-creating-connecting)를 참조합니다.
2. 세 condition을 별도 service로 운영할 때 세 service가 하나의 Postgres를 공유하도록 하고, 각 service에 `FIXED_CONDITION`을 하나씩 설정합니다. 허용 값은 `educator`, `coworker`, `future_self`입니다.
3. `FIXED_CONDITION`이 없는 service는 Postgres의 현재 최소 배정 수 condition을 `balanced` 방식으로 선택합니다.
4. Build Command는 `npm ci`, Start Command는 `npm start`, `NODE_ENV`는 `production`으로 설정합니다. `PORT`는 Render가 제공하므로 고정하지 않습니다.
5. `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATABASE_URL`을 등록합니다. `.env.example`에는 실제 secret을 넣지 않습니다.

`OPENAI_TIMEOUT_MS` 기본값은 30000ms, `OPENAI_MAX_RETRIES` 기본값은 0회, `REQUEST_LEASE_MS` 기본값은 120000ms입니다. `REQUEST_LEASE_MS`의 허용 최솟값은 다음과 같습니다.

```text
max(120000, OPENAI_TIMEOUT_MS × (OPENAI_MAX_RETRIES + 1) + 30000)
```

서버는 이 값보다 짧은 `REQUEST_LEASE_MS`를 거부합니다. 계산식은 [`runtime/config.js`](../runtime/config.js)에 구현되어 있습니다.

기본 fixed-window rate limit은 10분 기준으로 다음과 같습니다.

| 대상 | IP별 | 전체 service |
| --- | ---: | ---: |
| 사전설문 submit | 30 | 120 |
| LLM 요청 | 60 | 240 |

동시에 실행되는 LLM 요청은 최대 12개입니다. 한도는 `FIELD_RATE_LIMIT_WINDOW_MS`, `SUBMIT_RATE_LIMIT_MAX_PER_IP`, `SUBMIT_RATE_LIMIT_MAX_GLOBAL`, `LLM_RATE_LIMIT_MAX_PER_IP`, `LLM_RATE_LIMIT_MAX_GLOBAL`, `LLM_CONCURRENCY_MAX`로 조정합니다. 한도 초과는 HTTP 429와 `Retry-After`를 반환합니다. 현재 counter는 service instance memory에 있으므로 현장 실험은 자동 확장 없이 단일 instance로 운영합니다.

## 저장소와 보존

- `DATABASE_URL`이 있으면 Render Postgres가 session, participant UUID, 선택한 `scenarioRowId`, condition, 대화 Turn 상태와 request 상태를 저장합니다.
- Postgres가 없으면 memory store를 사용하며 process 종료 시 session이 사라집니다. 현장에는 Postgres 연결을 필수로 합니다.
- Render filesystem은 source of record가 아닙니다. [Render Persistent Disks 문서](https://render.com/docs/disks)를 참조합니다.
- `SAFER_DATA_DIR`를 설정한 local 검증에서만 `data/`와 `survey/` 호환 JSON export를 생성합니다. 현장 service에는 설정하지 않습니다.
- participant route는 Google Sheets를 직접 호출하지 않습니다. 완료된 데이터는 아래의 별도 exporter로 Postgres에서 읽습니다.

## Google Sheets export

Google Sheets는 보조 분석본이며 source of record는 계속 Postgres입니다. Exporter는 `phase=completed`인 session만 읽고 `participant_id`별 고정 행을 update합니다. 네트워크 오류 후 명령을 다시 실행해도 같은 참여자의 중복 행을 만들지 않습니다.

1. Google Cloud project에서 Service Account를 만들고 Google Sheets API를 활성화합니다.
2. 대상 Google Sheet의 `공유`에서 Service Account email을 `Editor`로 추가합니다. 개인 Google password나 domain-wide delegation은 필요하지 않습니다. [Google Service Account 문서](https://developers.google.com/workspace/guides/create-credentials#access_google_workspace_files_directly_with_a_service_account)를 참조합니다.
3. Render의 `Environment`에서 `GOOGLE_SHEETS_URL`과 필요하면 `GOOGLE_SHEETS_TAB`을 설정합니다.
4. Service Account JSON은 Git이나 일반 log에 넣지 않습니다. Render `Secret File`에 `google-service-account.json`으로 저장하고 `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/google-service-account.json`을 설정합니다. [Render Secret Files 문서](https://render.com/docs/configure-environment-variables#secret-files)를 참조합니다.
5. Postgres와 secret에 접근 가능한 승인된 환경에서 다음 명령을 실행합니다.

```bash
npm run export:google-sheets
```

정상 종료 log는 `total`, `inserted`, `updated` 건수만 표시하고 credential이나 설문 내용은 출력하지 않습니다. Sheet에는 `participant_id`, condition, scenario, 입력 방식, 대화·사전설문·사후설문 JSON이 기록됩니다. 사전설문의 name·org 등 개인정보가 포함될 수 있으므로 Sheet 공유 대상을 연구진으로 제한합니다. `session_id`는 cookie bearer이므로 export하지 않습니다. 값은 `RAW` 방식으로 써서 participant text가 Sheet formula로 실행되지 않습니다. Header를 운영자가 변경하면 exporter는 잘못된 column에 쓰지 않고 실패합니다.

Exporter 실행 중에는 Postgres advisory lock을 잡아 같은 database를 대상으로 두 export가 동시에 실행되지 않게 합니다. 한 번의 Google API 요청은 최대 100행으로 나누고 429·일시적 5xx 응답만 제한적으로 재시도합니다. 이 동작은 [Google Sheets values API](https://developers.google.com/workspace/sheets/api/guides/values)와 [quota 안내](https://developers.google.com/workspace/sheets/api/limits)를 따릅니다.

`safer_session` cookie는 `HttpOnly`, `SameSite=Lax`이고 HTTPS에서는 `Secure`입니다. participant API는 cookie session에서 권한 정보를 읽으며 client body의 participant ID, condition, scenario ID를 신뢰하지 않습니다.

## 배포 직후 개발자 점검

Render HTTPS 주소에서 다음을 확인합니다.

```bash
curl -sS https://YOUR_SERVICE.onrender.com/api/health
```

Postgres를 사용하는 service는 응답에서 다음을 만족해야 합니다.

- `store.kind`가 `postgres`
- `store.durable`가 `true`
- `credentials.database`가 `true`
- 고정 condition service의 `assignmentMode`가 `fixed`
- 통합 service의 `assignmentMode`가 `balanced`

응답에는 API key 값이 아니라 credential 존재 여부만 표시됩니다. `timing`과 `limits`가 계획한 Render 환경변수와 같은지도 확인합니다.

운영자에게 DB credential을 전달하지 않습니다. 개발자는 승인된 Postgres client에서 필요한 경우 아래처럼 최근 session과 condition별 배정 수를 확인합니다.

```sql
SELECT
  participant_id,
  condition,
  data->>'scenarioRowId' AS scenario_row_id,
  phase,
  created_at
FROM experiment_sessions
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT
  condition,
  COUNT(*)::int AS session_count
FROM experiment_sessions
GROUP BY condition
ORDER BY condition;
```

## 현장 운영자 점검

1. 각 tablet을 현장 Wi-Fi에 연결하고 captive portal 인증을 완료합니다.
2. 운영 전 10대 concurrent rehearsal에서 서로 다른 테스트 입력을 사용합니다.
3. 사전설문, scenario 선택, condition, Turn 0~6, 사후설문이 순서대로 진행되는지 확인합니다.
4. 네트워크를 잠시 끊었다가 복구하고 화면의 같은 retry 동작을 확인합니다. 같은 요청은 같은 `X-Request-Id`로 재시도해야 하며 새 ID로 중복 제출하지 않습니다.
5. 오류가 발생하면 운영자는 반복 제출하지 않고 개발자에게 알립니다. 개발자는 `/api/health`, Render log와 Postgres 상태를 확인한 뒤 retry 여부를 안내합니다.

SAFER는 offline mode를 지원하지 않습니다. tablet은 Render HTTPS에, Render server는 OpenAI와 Postgres에 접속해야 하므로 Wi-Fi box에 internet uplink가 필요합니다. 실험 전에 backup carrier, signal과 충전 상태를 확인합니다.

## 음성 기능 점검

기본 입력은 keyboard입니다. Turn 4에서 지원 browser의 `음성입력`을 누르면 `SpeechRecognition` 결과가 입력창에 들어오고, participant가 확인한 뒤 제출합니다. server에는 최종 text와 `inputMethod`(`keyboard` 또는 `dictation`)만 저장하며 raw audio는 녹음·저장·업로드하지 않습니다.

AI 메시지의 `듣기`는 tablet browser의 `speechSynthesis`를 사용하며 자동 재생하지 않습니다. 다른 메시지를 재생하면 이전 재생을 중지합니다.

실제 Galaxy 모델, Android와 Chrome 버전에서 microphone permission, Korean recognition, TTS voice·volume·지연을 모든 condition에 같은 설정으로 확인합니다. 음성 인식에 기기 또는 browser vendor의 외부 service가 사용될 수 있으므로 연구 동의와 개인정보 안내를 검토합니다.
