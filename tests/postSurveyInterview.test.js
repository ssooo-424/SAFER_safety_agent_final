const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDirectory = path.join(__dirname, '..', 'public');

test('post-survey keeps only the two approved open interview prompts', () => {
  const html = fs.readFileSync(path.join(publicDirectory, 'post-survey.html'), 'utf8');
  const script = fs.readFileSync(path.join(publicDirectory, 'post-survey.js'), 'utf8');

  assert.match(html, /id="int_1"/);
  assert.match(html, /id="int_2"/);
  assert.match(html, /추가적으로 느낀 점을 자유롭게 작성해 주세요\./);
  for (let index = 3; index <= 6; index += 1) {
    assert.doesNotMatch(html, new RegExp(`id="int_${index}"`));
  }
  assert.match(script, /for \(let index = 1; index <= 2; index \+= 1\)/);
});

test('Google Sheets research schema omits removed interview columns', () => {
  const { EXPORT_HEADERS } = require('../scripts/google_sheets/sessionRows');

  assert.ok(EXPORT_HEADERS.includes('interview_1'));
  assert.ok(EXPORT_HEADERS.includes('interview_2'));
  for (let index = 3; index <= 6; index += 1) {
    assert.equal(EXPORT_HEADERS.includes(`interview_${index}`), false);
  }
});
