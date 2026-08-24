const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createExperimentStore } = require('../lib/experimentStore');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function parseEnvExample(source) {
  const entries = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    assert.notEqual(separator, -1, `invalid env example line: ${line}`);
    entries[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return entries;
}

test('environment example has executable production defaults and safe placeholders', () => {
  const env = parseEnvExample(read('.env.example'));

  const requiredValues = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://USER:PASSWORD@INTERNAL_HOST:5432/DBNAME',
    OPENAI_API_KEY: 'replace-with-openai-api-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_TIMEOUT_MS: '30000',
    OPENAI_MAX_RETRIES: '0',
    REQUEST_LEASE_MS: '120000',
    FIELD_RATE_LIMIT_WINDOW_MS: '600000',
    SUBMIT_RATE_LIMIT_MAX_PER_IP: '30',
    SUBMIT_RATE_LIMIT_MAX_GLOBAL: '120',
    LLM_RATE_LIMIT_MAX_PER_IP: '60',
    LLM_RATE_LIMIT_MAX_GLOBAL: '240',
    LLM_CONCURRENCY_MAX: '12',
    FIXED_CONDITION: '',
    GOOGLE_SHEETS_URL: 'https://docs.google.com/spreadsheets/d/replace-with-spreadsheet-id/edit',
    GOOGLE_SHEETS_TAB: 'SAFER_EXPORT',
    GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/google-service-account.json',
  };
  for (const [key, value] of Object.entries(requiredValues)) {
    assert.equal(env[key], value, `unexpected ${key} value`);
  }
  assert.equal(env.ASSIGNMENT_MODE, undefined);
  assert.doesNotMatch(read('.env.example'), /sk-[A-Za-z0-9_-]+|BEGIN PRIVATE KEY|AIza/);
});

test('store selection follows DATABASE_URL and fixed-condition configuration', async () => {
  const memoryStore = createExperimentStore({
    env: { ASSIGNMENT_MODE: 'fixed' },
  });
  assert.equal(memoryStore.durable, false);
  assert.equal(memoryStore.fixedCondition, undefined);
  await memoryStore.close();

  const pool = { query: async () => ({ rows: [], rowCount: 0 }) };
  const postgresStore = createExperimentStore({
    env: {
      DATABASE_URL: 'postgresql://render.internal/safer',
      FIXED_CONDITION: 'coworker',
    },
    pool,
  });
  assert.equal(postgresStore.durable, true);
  assert.equal(postgresStore.fixedCondition, 'coworker');
  assert.equal(postgresStore.pool, pool);
  await postgresStore.close();

  assert.throws(
    () => createExperimentStore({ env: { FIXED_CONDITION: 'invalid' } }),
    /unsupported condition: invalid/,
  );
});

test('the trackable environment example is not ignored by git', () => {
  const result = spawnSync('git', ['check-ignore', '.env.example'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, `git check-ignore unexpectedly matched: ${result.stdout}`);
});
