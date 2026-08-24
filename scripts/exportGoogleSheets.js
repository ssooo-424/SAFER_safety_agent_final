const { Pool } = require('pg');
const { google } = require('googleapis');

const {
  SheetsExportConfigError,
  loadSheetsExportConfig,
} = require('./google_sheets/config');
const { exportCompletedSessions } = require('./google_sheets/exporter');
const { createSheetsGateway } = require('./google_sheets/sheetsGateway');

require('dotenv').config({ quiet: true });

async function main(env = process.env) {
  const config = loadSheetsExportConfig(env);
  const auth = new google.auth.GoogleAuth({
    ...(config.credentials ? { credentials: config.credentials } : {}),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    const result = await exportCompletedSessions({
      pool,
      gateway: createSheetsGateway({
        sheets,
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
      }),
    });
    console.log(
      `Google Sheets export 완료: total=${result.total}, inserted=${result.inserted}, updated=${result.updated}`,
    );
    return result;
  } finally {
    await pool.end();
  }
}

function formatExportFailure(error) {
  if (error instanceof SheetsExportConfigError) {
    return `Google Sheets export 실패: ${error.message}`;
  }
  const status = Number(error?.response?.status || error?.status || 0);
  if (Number.isInteger(status) && status > 0) {
    return `Google Sheets export 실패: status=${status}`;
  }
  const code = String(error?.code || '').trim();
  if (/^[A-Z0-9_]{1,40}$/.test(code)) {
    return `Google Sheets export 실패: code=${code}`;
  }
  return 'Google Sheets export 실패: credential, Sheet 권한과 DATABASE_URL을 확인하세요.';
}

if (require.main === module) {
  main().catch((error) => {
    console.error(formatExportFailure(error));
    process.exitCode = 1;
  });
}

module.exports = { formatExportFailure, main };
