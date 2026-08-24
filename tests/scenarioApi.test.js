const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const scenarioSource = require('../reference_data/scenarios.json');

let appServer;
let serverModule;
let baseUrl;
let dataDir;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safer-scenarios-http-'));
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'http://127.0.0.1:1/v1';
  process.env.SAFER_DATA_DIR = dataDir;
  delete process.env.DATABASE_URL;
  delete process.env.FIXED_CONDITION;

  serverModule = require('../server');
  await serverModule.ready;
  appServer = http.createServer(serverModule.app);
  const address = await listen(appServer);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await close(appServer);
  if (serverModule.close) await serverModule.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('Given a profile code, when source scenarios are requested, then the endpoint returns source content without warnings', async () => {
  const major = '마감공사';
  const detail = '마감공사';
  const expected = scenarioSource[major][detail][0];
  const logs = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args) => logs.push({ level: 'error', args });
  console.warn = (...args) => logs.push({ level: 'warn', args });

  let response;
  let body;
  try {
    response = await fetch(`${baseUrl}/api/scenarios?major=${encodeURIComponent(major)}&detail=${encodeURIComponent(detail)}&profileCode=future_self`);
    body = await response.json();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.scenarios[0].id, expected.id);
  assert.equal(body.scenarios[0].scenario, expected.scenario);
  assert.deepEqual(logs, []);
});
