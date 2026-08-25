const { EXPORT_HEADERS } = require('./sessionRows');

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_BATCH_ROWS = 100;

function quoteSheetName(sheetName) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function statusOf(error) {
  return Number(error?.response?.status || error?.code || 0);
}

async function withRetry(operation, { sleep, random, maxAttempts = 5 }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!RETRYABLE_STATUS.has(statusOf(error)) || attempt === maxAttempts) throw error;
      const delayMs = Math.min(8_000, 250 * (2 ** (attempt - 1))) + Math.floor(random() * 250);
      await sleep(delayMs);
    }
  }
  throw new Error('Google Sheets retry loop ended unexpectedly');
}

function sameHeader(actual, headers) {
  return actual.length === headers.length
    && actual.every((value, index) => value === headers[index]);
}

function isHeaderPrefix(actual, headers) {
  return actual.length > 0
    && actual.length < headers.length
    && actual.every((value, index) => value === headers[index]);
}

function columnName(columnNumber) {
  let value = columnNumber;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function createSheetsGateway({
  sheets,
  spreadsheetId,
  sheetName,
  headers = EXPORT_HEADERS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
}) {
  const quotedName = quoteSheetName(sheetName);
  const lastColumn = columnName(headers.length);
  const retryOptions = { sleep, random };

  async function tabExists() {
    const response = await withRetry(
      () => sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      }),
      retryOptions,
    );
    return (response.data.sheets || []).some(
      (sheet) => sheet.properties?.title === sheetName,
    );
  }

  async function ensureTab() {
    if (await tabExists()) return;
    await withRetry(async () => {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
        });
      } catch (error) {
        if (RETRYABLE_STATUS.has(statusOf(error)) && await tabExists()) return;
        throw error;
      }
    }, retryOptions);
  }

  async function readIndex() {
    const response = await withRetry(
      () => sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [`${quotedName}!A1:${lastColumn}1`, `${quotedName}!A2:${lastColumn}`],
        majorDimension: 'ROWS',
      }),
      retryOptions,
    );
    const [headerRange = {}, rowRange = {}] = response.data.valueRanges || [];
    const header = headerRange.values?.[0] || [];
    if (header.length === 0) {
      await withRetry(
        () => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${quotedName}!A1:${lastColumn}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        }),
        retryOptions,
      );
    } else if (isHeaderPrefix(header, headers)) {
      await withRetry(
        () => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${quotedName}!A1:${lastColumn}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        }),
        retryOptions,
      );
    } else if (!sameHeader(header, headers)) {
      throw new Error(`Google Sheets header does not match exporter schema: ${sheetName}`);
    }
    const rows = rowRange.values || [];
    const rowByParticipant = new Map();
    rows.forEach((values, index) => {
      const participantId = String(values?.[0] || '').trim();
      if (!participantId) return;
      if (rowByParticipant.has(participantId)) {
        throw new Error(`duplicate participant_id in Google Sheets: ${participantId}`);
      }
      rowByParticipant.set(participantId, index + 2);
    });
    return { rowByParticipant, nextRow: rows.length + 2 };
  }

  async function writeRows(data) {
    for (const batch of chunk(data, MAX_BATCH_ROWS)) {
      await withRetry(
        () => sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: 'RAW', data: batch },
        }),
        retryOptions,
      );
    }
  }

  async function upsertRows(rows) {
    await ensureTab();
    const { rowByParticipant, nextRow: initialNextRow } = await readIndex();
    let nextRow = initialNextRow;
    let inserted = 0;
    let updated = 0;
    const data = rows.map((row) => {
      const participantId = String(row[0] || '').trim();
      if (!participantId) throw new Error('participant_id is required for Google Sheets export');
      const existingRow = rowByParticipant.get(participantId);
      const targetRow = existingRow || nextRow++;
      if (existingRow) updated += 1;
      else inserted += 1;
      return {
        range: `${quotedName}!A${targetRow}:${lastColumn}${targetRow}`,
        majorDimension: 'ROWS',
        values: [row],
      };
    });
    await writeRows(data);
    return { total: rows.length, inserted, updated };
  }

  return { upsertRows };
}

module.exports = { columnName, createSheetsGateway, quoteSheetName, withRetry };
