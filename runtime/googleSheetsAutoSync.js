const { google } = require('googleapis');
const fs = require('node:fs');

const {
  loadSheetsTargetConfig,
} = require('../scripts/google_sheets/config');
const {
  buildExportRow,
  EXPORT_HEADERS,
} = require('../scripts/google_sheets/sessionRows');
const {
  createSheetsGateway,
} = require('../scripts/google_sheets/sheetsGateway');

function safeErrorMetadata(error) {
  return {
    status: Number(error?.response?.status || error?.status || 0) || undefined,
    code: /^[A-Z0-9_]{1,40}$/.test(String(error?.code || ''))
      ? String(error.code)
      : undefined,
  };
}

function createGoogleSheetsAutoSync({ env = process.env, store, logger = console, gateway } = {}) {
  if (env.NODE_TEST_CONTEXT) {
    return { enabled: false, sheetName: '', syncSessionById: async () => ({ skipped: true }) };
  }
  if (String(env.GOOGLE_SHEETS_AUTO_SYNC || 'true').trim().toLowerCase() === 'false') {
    return { enabled: false, sheetName: '', syncSessionById: async () => ({ skipped: true }) };
  }

  let config;
  try {
    config = loadSheetsTargetConfig(env);
  } catch {
    return { enabled: false, sheetName: '', syncSessionById: async () => ({ skipped: true }) };
  }
  const credentialPath = String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!config.credentials && (!credentialPath || !fs.existsSync(credentialPath))) {
    return { enabled: false, sheetName: '', syncSessionById: async () => ({ skipped: true }) };
  }

  let resolvedGateway = gateway;
  if (!resolvedGateway) {
    const auth = new google.auth.GoogleAuth({
      ...(config.credentials ? { credentials: config.credentials } : {}),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    resolvedGateway = createSheetsGateway({
      sheets,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      headers: EXPORT_HEADERS,
    });
  }
  let queue = Promise.resolve();

  function syncSessionById(sessionId) {
    const operation = queue.then(async () => {
      const session = await store.getSession(sessionId);
      if (!session) return { skipped: true };
      return resolvedGateway.upsertRows([buildExportRow(session)]);
    });
    queue = operation.catch(() => undefined);
    return operation.catch((error) => {
      logger.error('Google Sheets automatic sync failed', safeErrorMetadata(error));
      return { failed: true };
    });
  }

  return {
    enabled: true,
    sheetName: config.sheetName,
    syncSessionById,
  };
}

module.exports = { createGoogleSheetsAutoSync, safeErrorMetadata };
