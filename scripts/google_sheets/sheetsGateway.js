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

function sameHeader(actual) {
  return actual.length === EXPORT_HEADERS.length
    && actual.every((value, index) => value === EXPORT_HEADERS[index]);
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
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
}) {
  const quotedName = quoteSheetName(sheetName);
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
        ranges: [`${quotedName}!A1:S1`, `${quotedName}!A2:S`],
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
          range: `${quotedName}!A1:S1`,
          valueInputOption: 'RAW',
          requestBody: { values: [EXPORT_HEADERS] },
        }),
        retryOptions,
      );
    } else if (!sameHeader(header)) {
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
        range: `${quotedName}!A${targetRow}:S${targetRow}`,
        majorDimension: 'ROWS',
        values: [row],
      };
    });
    await writeRows(data);
    return { total: rows.length, inserted, updated };
  }

  return { upsertRows };
}

module.exports = { createSheetsGateway, quoteSheetName, withRetry };
