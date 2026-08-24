# SAFER

SAFER(Safety Agent Framework for Experimental Roles)는 건설근로자의 안전행동을 지원하는 연구용 web prototype입니다. 같은 사고 시나리오와 핵심 안전수칙을 `AI 안전교육자`, `동료 작업자 AI`, `미래의 나 AI`가 서로 다른 관계와 관점으로 전달하도록 하여 위험 인식, 자기 관련성, 감정 반응과 안전행동 의도를 비교합니다.

## 참여자 흐름

1. 사전설문에서 작업 상황을 입력합니다.
2. 대공정·세부공정에 맞는 사고 시나리오 후보를 최대 3개 확인하고 하나를 선택합니다.
3. 서버가 배정한 condition으로 Turn 0~6 대화를 진행합니다.
4. Turn 4에서 예방 행동을 키보드 또는 선택적 `음성입력`으로 입력합니다.
5. 사후설문을 제출합니다.

선택한 사고 사실과 세 가지 핵심 안전수칙은 모든 condition에서 같고, 관계·말투·framing만 다릅니다.

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm ci
cp .env.example .env
npm start
```

`.env`에는 `OPENAI_API_KEY`를 설정합니다. Postgres를 사용하려면 `DATABASE_URL`도 설정합니다. 전체 변수와 기본값은 [`.env.example`](.env.example)에 있습니다.

실행 후 [http://localhost:3001](http://localhost:3001)을 열어 참여자 흐름을 확인합니다. 상태 확인은 `GET /api/health`입니다.

`DATABASE_URL`이 있으면 Postgres를 사용하고, 없으면 프로세스 안에서만 유지되는 memory store를 사용합니다. 현장 실험에서는 Render Postgres를 source of record로 사용합니다. `FIXED_CONDITION`이 없으면 세 condition을 현재 최소 배정 수 기준으로 `balanced` 배정하고, 설정하면 `educator`, `coworker`, `future_self` 중 해당 condition으로 고정합니다.

## 음성 기능

- Turn 4의 `음성입력`은 browser `SpeechRecognition` 또는 `webkitSpeechRecognition`을 사용합니다.
- SAFER는 raw audio를 녹음·업로드·저장하지 않고 최종 text와 `inputMethod`만 저장합니다.
- AI 메시지의 `듣기`는 사용자가 누를 때 browser `speechSynthesis`를 실행하며 자동 재생하지 않습니다.
- browser 또는 vendor가 음성 인식을 외부 service에서 처리할 수 있으므로 실제 Galaxy tablet에서 동의 문구, microphone 권한, Korean recognition과 TTS를 확인해야 합니다.

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `server.js` | Express application composition과 startup |
| `runtime/` | route, session, scenario, safety-case service |
| `lib/` | experiment store, request lease, rate limit |
| `llm/` | condition별 prompt, agent, safety rule |
| `public/` | participant UI와 scenario review UI |
| `reference_data/` | 237개 scenario source와 safety measure data |
| `scripts/` | scenario validation과 research metric 도구 |
| `tests/` | unit·HTTP integration·security·UI contract test |

## 테스트

```bash
npm test
```

Postgres integration test는 `TEST_DATABASE_URL`이 있을 때 실행됩니다. 시나리오 검증 workflow는 외부 또는 로컬에 준비한 review bundle을 사용합니다.

```bash
npm run test:scenario-validation
```

## Google Sheets export

현장 요청 중에는 Postgres에만 저장하고, 완료된 session은 별도 명령으로 Google Sheets에 export합니다. 따라서 Sheets 장애가 참여자 흐름이나 Postgres 저장을 막지 않습니다.

1. Google Cloud에서 Service Account를 만들고 Google Sheets API를 활성화합니다.
2. 대상 Google Sheet를 Service Account email에 `Editor` 권한으로 공유합니다. Google 계정 비밀번호는 사용하지 않습니다.
3. `DATABASE_URL`, `GOOGLE_SHEETS_URL`, `GOOGLE_SHEETS_TAB`을 설정합니다.
4. Service Account JSON은 repository에 넣지 않고 `GOOGLE_APPLICATION_CREDENTIALS`가 가리키는 secret file로 제공합니다. `GOOGLE_SERVICE_ACCOUNT_JSON` 환경변수도 지원합니다.
5. 다음 명령을 실행합니다.

```bash
npm run export:google-sheets
```

Exporter는 `phase=completed`인 session만 읽으며 `participant_id`를 기준으로 기존 행을 update하고 새 행만 추가합니다. 재실행해도 같은 참여자의 행이 중복되지 않습니다. `safer_session` cookie에 사용되는 `session_id`는 Sheet에 내보내지 않습니다. 세부 운영 절차는 [현장 배포 및 운영](docs/FIELD_DEPLOYMENT.md)을 따릅니다.

## 문서

- [Developer handoff](DEVELOPER_HANDOFF.md)
- [현장 배포 및 운영](docs/FIELD_DEPLOYMENT.md)
- [시나리오 검증 protocol](docs/SCENARIO_VALIDATION_PROTOCOL.md)

## 데이터 및 보안

- `.env`, API key, database credential을 Git에 추가하지 않습니다.
- participant response와 experiment result를 repository에 저장하지 않습니다.
- 현장 실험 전에는 paid Render Web Service, paid Postgres, 실제 tablet과 hotspot 환경에서 concurrent rehearsal을 수행합니다.
