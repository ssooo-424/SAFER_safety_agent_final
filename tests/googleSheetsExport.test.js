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
  createSheetsGateway,
} = require('../scripts/google_sheets/sheetsGateway');
const {
  exportCompletedSessions,
} = require('../scripts/google_sheets/exporter');
const { formatExportFailure } = require('../scripts/exportGoogleSheets');

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
  assert.equal(config.sheetName, '현장실험');
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
  assert.equal(row[7], '익명1');
  assert.equal(row[8], '현장A');
  assert.equal(row[9], 'dictation');
  assert.equal(row[10], '=말한 내용');
  assert.equal(row.includes('must-not-be-exported'), false);
  assert.equal(JSON.parse(row.at(-1)).q1, 5);
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
    ["'현장실험'!A2:S2", "'현장실험'!A4:S4"],
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
