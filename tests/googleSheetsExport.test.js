const assert = require('node:assert/strict');
const test = require('node:test');

const {
  loadSheetsExportConfig,
} = require('../scripts/google_sheets/config');
const {
  EXPORT_HEADERS,
  buildExportRow,
} = require('../scripts/google_sheets/sessionRows');
const {
  columnName,
  createSheetsGateway,
} = require('../scripts/google_sheets/sheetsGateway');
const {
  exportCompletedSessions,
} = require('../scripts/google_sheets/exporter');
const { formatExportFailure } = require('../scripts/exportGoogleSheets');
const { createGoogleSheetsAutoSync } = require('../runtime/googleSheetsAutoSync');

function automaticSyncEnv() {
  return {
    GOOGLE_SHEETS_URL: 'https://docs.google.com/spreadsheets/d/test-sheet_123/edit',
    GOOGLE_SHEETS_TAB: 'SAFER_EXPORT',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: 'service_account',
      client_email: 'safer-export@example.iam.gserviceaccount.com',
      private_key: 'private-value',
    }),
  };
}

test('Google Sheets export config accepts a target URL and Service Account JSON', () => {
  const config = loadSheetsExportConfig({
    DATABASE_URL: 'postgresql://render.internal/safer',
    GOOGLE_SHEETS_URL: 'https://docs.google.com/spreadsheets/d/test-sheet_123/edit#gid=0',
    GOOGLE_SHEETS_TAB: '현장실험',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: 'service_account',
      client_email: 'safer-export@example.iam.gserviceaccount.com',
      private_key: 'private-value',
    }),
  });

  assert.equal(config.databaseUrl, 'postgresql://render.internal/safer');
  assert.equal(config.spreadsheetId, 'test-sheet_123');
  assert.equal(config.sheetName, '현장실험_ANALYSIS');
  assert.equal(config.credentials.client_email, 'safer-export@example.iam.gserviceaccount.com');
  assert.equal(JSON.stringify(config).includes('private-value'), true);
});

test('Google Sheets CLI failure output never includes an upstream secret-bearing message', () => {
  const error = new Error('private-value must never be printed');
  error.response = { status: 403 };

  const output = formatExportFailure(error);

  assert.equal(output, 'Google Sheets export 실패: status=403');
  assert.equal(output.includes('private-value'), false);
});

test('Google Sheets export config rejects a missing Service Account credential boundary', () => {
  assert.throws(
    () => loadSheetsExportConfig({
      DATABASE_URL: 'postgresql://render.internal/safer',
      GOOGLE_SHEETS_SPREADSHEET_ID: 'test-sheet',
    }),
    /Google Service Account credentials are required/,
  );
});

test('completed session maps to one stable research row without the session bearer ID', () => {
  const row = buildExportRow({
    sessionId: 'must-not-be-exported',
    participantId: 'participant-1',
    condition: 'coworker',
    assignmentMode: 'balanced',
    phase: 'completed',
    createdAt: '2026-08-22T01:00:00.000Z',
    completedAt: '2026-08-22T01:10:00.000Z',
    data: {
      scenarioRowId: 42,
      preSurvey: { profile: { org: '현장A', name: '익명1' }, answer: 3 },
      safetyCase: { title: '사고' },
      turn0: { assistant: '안내' },
      introScript: { turn1: '첫 메시지' },
      turn4: { assistant: '질문' },
      turn5: { inputMethod: 'dictation', userMessage: '=말한 내용', response: { ok: true } },
      turn6: { assistant: '마무리' },
      postSurvey: { q1: 5 },
    },
  });

  assert.equal(row.length, EXPORT_HEADERS.length);
  assert.equal(row[0], 'participant-1');
  assert.equal(row[1], 'coworker');
  assert.equal(row[4], 42);
  assert.equal(row[EXPORT_HEADERS.indexOf('name')], '익명1');
  assert.equal(row[EXPORT_HEADERS.indexOf('org')], '현장A');
  assert.equal(EXPORT_HEADERS.includes('profile_code'), true);
  assert.equal(row[EXPORT_HEADERS.indexOf('profile_code')], '');
  assert.equal(EXPORT_HEADERS.includes('low_reason'), true);
  assert.equal(row[EXPORT_HEADERS.indexOf('low_reason')], '');
  assert.equal(row[EXPORT_HEADERS.indexOf('turn5_input_method')], 'dictation');
  assert.equal(row[EXPORT_HEADERS.indexOf('turn5_user_message')], '=말한 내용');
  assert.equal(row.includes('must-not-be-exported'), false);
  assert.equal(JSON.parse(row[EXPORT_HEADERS.indexOf('post_survey_json')]).q1, 5);
});

test('pre-survey risk perception and age group are appended to the final Google Sheets columns', () => {
  const row = buildExportRow({
    participantId: 'participant-risk',
    condition: 'educator',
    assignmentMode: 'balanced',
    phase: 'created',
    createdAt: '2026-08-28T01:00:00.000Z',
    data: {
      preSurvey: {
        profile: { ageGroup: '40대' },
        psychology: { riskPerception: { R1: 70, R2: 60, R3: 20 } },
      },
    },
  });

  assert.deepEqual(EXPORT_HEADERS.slice(-4), ['pre_R1', 'pre_R2', 'pre_R3', 'age_group']);
  assert.deepEqual(row.slice(-4), [70, 60, 20, '40대']);
  assert.equal(row.length, EXPORT_HEADERS.length);
});

test('Sheets gateway updates known participants and assigns new participants deterministic rows', async () => {
  const writes = [];
  const sheets = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: '현장실험' } }] } }),
      batchUpdate: async () => {
        throw new Error('existing tab must not be recreated');
      },
      values: {
        batchGet: async () => ({
          data: {
            valueRanges: [
              { values: [EXPORT_HEADERS] },
              { values: [['participant-1'], ['', 'occupied manual row']] },
            ],
          },
        }),
        update: async () => {
          throw new Error('existing header must not be rewritten');
        },
        batchUpdate: async (request) => {
          writes.push(request);
          return { data: {} };
        },
      },
    },
  };
  const gateway = createSheetsGateway({
    sheets,
    spreadsheetId: 'sheet-id',
    sheetName: '현장실험',
    sleep: async () => {},
  });
  const existing = ['participant-1', ...Array(EXPORT_HEADERS.length - 1).fill('old')];
  const added = ['participant-2', ...Array(EXPORT_HEADERS.length - 1).fill('new')];

  const result = await gateway.upsertRows([existing, added]);

  assert.deepEqual(result, { total: 2, inserted: 1, updated: 1 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].requestBody.valueInputOption, 'RAW');
  assert.deepEqual(
    writes[0].requestBody.data.map((entry) => entry.range),
    [
      `'현장실험'!A2:${columnName(EXPORT_HEADERS.length)}2`,
      `'현장실험'!A4:${columnName(EXPORT_HEADERS.length)}4`,
    ],
  );
});

test('Sheets gateway reconciles an ambiguous tab-creation failure before retrying', async () => {
  let tabExists = false;
  let addCalls = 0;
  const sheets = {
    spreadsheets: {
      get: async () => ({
        data: { sheets: tabExists ? [{ properties: { title: 'SAFER_EXPORT' } }] : [] },
      }),
      batchUpdate: async () => {
        addCalls += 1;
        tabExists = true;
        const error = new Error('response lost after creation');
        error.response = { status: 503 };
        throw error;
      },
      values: {
        batchGet: async () => ({ data: { valueRanges: [{ values: [] }, { values: [] }] } }),
        update: async () => ({ data: {} }),
        batchUpdate: async () => ({ data: {} }),
      },
    },
  };
  const gateway = createSheetsGateway({
    sheets,
    spreadsheetId: 'sheet-id',
    sheetName: 'SAFER_EXPORT',
    sleep: async () => {},
  });

  const result = await gateway.upsertRows([
    ['participant-1', ...Array(EXPORT_HEADERS.length - 1).fill('value')],
  ]);

  assert.deepEqual(result, { total: 1, inserted: 1, updated: 0 });
  assert.equal(addCalls, 1);
});

test('Sheets gateway safely extends an existing analysis header with appended timing columns', async () => {
  const headerUpdates = [];
  const writes = [];
  const priorHeaders = EXPORT_HEADERS.slice(0, EXPORT_HEADERS.indexOf('turn0_dwell_sec'));
  const sheets = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: 'SAFER_EXPORT_ANALYSIS' } }] } }),
      batchUpdate: async () => ({ data: {} }),
      values: {
        batchGet: async () => ({
          data: { valueRanges: [{ values: [priorHeaders] }, { values: [['participant-old']] }] },
        }),
        update: async request => {
          headerUpdates.push(request.requestBody.values[0]);
          return { data: {} };
        },
        batchUpdate: async request => {
          writes.push(request);
          return { data: {} };
        },
      },
    },
  };
  const gateway = createSheetsGateway({
    sheets,
    spreadsheetId: 'sheet-id',
    sheetName: 'SAFER_EXPORT_ANALYSIS',
  });

  const result = await gateway.upsertRows([
    ['participant-new', ...Array(EXPORT_HEADERS.length - 1).fill('')],
  ]);

  assert.deepEqual(result, { total: 1, inserted: 1, updated: 0 });
  assert.deepEqual(headerUpdates, [EXPORT_HEADERS]);
  assert.equal(writes.length, 1);
});

test('export reads only completed Postgres sessions while holding one advisory lock', async () => {
  const queries = [];
  let released = false;
  const session = {
    participant_id: 'participant-1',
    condition: 'educator',
    assignment_mode: 'balanced',
    phase: 'completed',
    created_at: new Date('2026-08-22T01:00:00.000Z'),
    completed_at: new Date('2026-08-22T01:10:00.000Z'),
    data: { scenarioRowId: 10, postSurvey: { q1: 4 } },
  };
  const client = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
      if (sql.includes('FROM experiment_sessions')) return { rows: [session] };
      if (sql.includes('pg_advisory_unlock')) return { rows: [{ unlocked: true }] };
      throw new Error(`unexpected query: ${sql}`);
    },
    release: () => {
      released = true;
    },
  };
  const receivedRows = [];
  const result = await exportCompletedSessions({
    pool: { connect: async () => client },
    gateway: {
      upsertRows: async (rows) => {
        receivedRows.push(...rows);
        return { total: rows.length, inserted: rows.length, updated: 0 };
      },
    },
  });

  assert.deepEqual(result, { total: 1, inserted: 1, updated: 0 });
  assert.equal(receivedRows[0][0], 'participant-1');
  assert.match(queries.find((sql) => sql.includes('FROM experiment_sessions')), /phase = 'completed'/);
  assert.equal(queries.some((sql) => sql.includes('pg_advisory_unlock')), true);
  assert.equal(released, true);
});

test('completed post-survey sessions automatically upsert one analysis row', async () => {
  const receivedRows = [];
  const sync = createGoogleSheetsAutoSync({
    env: automaticSyncEnv(),
    store: {
      getSession: async () => ({
        participantId: 'participant-auto',
        condition: 'future_self',
        assignmentMode: 'balanced',
        phase: 'completed',
        createdAt: '2026-08-25T01:00:00.000Z',
        data: {
          scenarioRowId: 25,
          turn5: { userMessage: '작업 전 가스 농도를 확인한다', inputMethod: 'keyboard' },
          postSurvey: { timestamp: '2026-08-25T01:10:00.000Z', data: { P1_1: 5 } },
        },
      }),
    },
    gateway: {
      upsertRows: async (rows) => {
        receivedRows.push(...rows);
        return { total: rows.length, inserted: 1, updated: 0 };
      },
    },
  });

  const result = await sync.syncSessionById('session-auto');

  assert.equal(sync.enabled, true);
  assert.equal(sync.sheetName, 'SAFER_EXPORT_ANALYSIS');
  assert.deepEqual(result, { total: 1, inserted: 1, updated: 0 });
  assert.equal(receivedRows[0][EXPORT_HEADERS.indexOf('participant_id')], 'participant-auto');
  assert.equal(receivedRows[0][EXPORT_HEADERS.indexOf('turn5_user_message')], '작업 전 가스 농도를 확인한다');
  assert.equal(receivedRows[0][EXPORT_HEADERS.indexOf('P1_1')], 5);
});

test('index pre-survey submissions create a partial analysis row before conversation completion', async () => {
  const receivedRows = [];
  const sync = createGoogleSheetsAutoSync({
    env: automaticSyncEnv(),
    store: {
      getSession: async () => ({
        participantId: 'participant-pre',
        condition: 'coworker',
        assignmentMode: 'balanced',
        phase: 'created',
        createdAt: '2026-08-25T02:00:00.000Z',
        data: {
          scenarioRowId: 82,
          preSurvey: {
            profile: { name: '사전 참여자', org: '삼성중공업', jobType: ['기능공'] },
            incident: { majorProcess: '조립', riskType: '끼임', sentence: '선택한 사고 시나리오' },
          },
        },
      }),
    },
    gateway: {
      upsertRows: async (rows) => {
        receivedRows.push(...rows);
        return { total: rows.length, inserted: 1, updated: 0 };
      },
    },
  });

  const result = await sync.syncSessionById('pre-session');
  const row = receivedRows[0];

  assert.deepEqual(result, { total: 1, inserted: 1, updated: 0 });
  assert.equal(row[EXPORT_HEADERS.indexOf('phase')], 'created');
  assert.equal(row[EXPORT_HEADERS.indexOf('name')], '사전 참여자');
  assert.equal(row[EXPORT_HEADERS.indexOf('org')], '삼성중공업');
  assert.equal(row[EXPORT_HEADERS.indexOf('selected_scenario')], '선택한 사고 시나리오');
  assert.equal(row[EXPORT_HEADERS.indexOf('post_survey_json')], '');
});

test('analysis rows expose per-turn active dwell and separate hidden time', () => {
  const row = buildExportRow({
    participantId: 'participant-timing',
    condition: 'educator',
    assignmentMode: 'balanced',
    phase: 'turn_2_completed',
    createdAt: '2026-08-25T01:00:00.000Z',
    data: {
      scenarioRowId: 1,
      turnTimings: {
        turn0: { activeMs: 8_400, totalMs: 9_000, hiddenMs: 600 },
        turn1: { activeMs: 15_200, totalMs: 17_000, hiddenMs: 1_800 },
      },
    },
  });

  assert.equal(row[EXPORT_HEADERS.indexOf('turn0_dwell_sec')], 8.4);
  assert.equal(row[EXPORT_HEADERS.indexOf('turn1_dwell_sec')], 15.2);
  assert.equal(row[EXPORT_HEADERS.indexOf('chat_total_dwell_sec')], 23.6);
  assert.equal(row[EXPORT_HEADERS.indexOf('chat_total_elapsed_sec')], 26);
  assert.equal(row[EXPORT_HEADERS.indexOf('chat_hidden_sec')], 2.4);
  assert.equal(JSON.parse(row[EXPORT_HEADERS.indexOf('turn_timings_json')]).turn0.activeMs, 8_400);
});
