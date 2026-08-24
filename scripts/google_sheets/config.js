const DEFAULT_SHEET_NAME = 'SAFER_EXPORT';
const SPREADSHEET_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

class SheetsExportConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SheetsExportConfigError';
  }
}

function spreadsheetIdFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SheetsExportConfigError('GOOGLE_SHEETS_URL must be a valid Google Sheets URL');
  }
  const match = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/);
  if (url.hostname !== 'docs.google.com' || !match) {
    throw new SheetsExportConfigError('GOOGLE_SHEETS_URL must point to docs.google.com/spreadsheets');
  }
  return match[1];
}

function resolveSpreadsheetId(env) {
  const directId = String(env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const spreadsheetId = directId || spreadsheetIdFromUrl(String(env.GOOGLE_SHEETS_URL || '').trim());
  if (!SPREADSHEET_ID_PATTERN.test(spreadsheetId)) {
    throw new SheetsExportConfigError('Google Sheets spreadsheet ID is invalid');
  }
  return spreadsheetId;
}

function parseCredentials(value) {
  if (!value) return undefined;
  let credentials;
  try {
    credentials = JSON.parse(value);
  } catch {
    throw new SheetsExportConfigError('GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON');
  }
  if (
    credentials?.type !== 'service_account'
    || typeof credentials.client_email !== 'string'
    || typeof credentials.private_key !== 'string'
  ) {
    throw new SheetsExportConfigError('GOOGLE_SERVICE_ACCOUNT_JSON must contain Service Account credentials');
  }
  return credentials;
}

function loadSheetsExportConfig(env = process.env) {
  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new SheetsExportConfigError('DATABASE_URL is required for Google Sheets export');
  }
  const sheetName = String(env.GOOGLE_SHEETS_TAB || DEFAULT_SHEET_NAME).trim();
  if (!sheetName || sheetName.length > 100 || /[:\\/?*\[\]]/.test(sheetName)) {
    throw new SheetsExportConfigError('GOOGLE_SHEETS_TAB is invalid');
  }
  const credentials = parseCredentials(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!credentials && !String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) {
    throw new SheetsExportConfigError('Google Service Account credentials are required');
  }
  return {
    databaseUrl,
    spreadsheetId: resolveSpreadsheetId(env),
    sheetName,
    credentials,
  };
}

module.exports = {
  DEFAULT_SHEET_NAME,
  SheetsExportConfigError,
  loadSheetsExportConfig,
  resolveSpreadsheetId,
};
