const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const publicDirectory = path.join(__dirname, '..', 'public');
const activePages = ['index.html', 'safer.html', 'post-survey.html'];

function localAssetReferences(html) {
  const references = [];
  const tags = html.match(/<(?:link|script)\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const match = tag.match(/\b(?:href|src)=["']([^"']+)["']/i);
    if (!match) continue;

    const reference = match[1].split(/[?#]/, 1)[0];
    if (reference && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
      references.push(reference.replace(/^\//, ''));
    }
  }

  return references;
}

test('active-flow local stylesheet, icon, and script references resolve to public files', () => {
  for (const page of activePages) {
    const html = fs.readFileSync(path.join(publicDirectory, page), 'utf8');

    for (const reference of localAssetReferences(html)) {
      assert.ok(
        fs.existsSync(path.join(publicDirectory, reference)),
        `${page} references missing public asset ${reference}`,
      );
    }
  }
});

test('every active-flow page declares the shared favicon', () => {
  for (const page of activePages) {
    const html = fs.readFileSync(path.join(publicDirectory, page), 'utf8');

    assert.match(
      html,
      /<link\b[^>]*rel=["'][^"']*\bicon\b[^"']*["'][^>]*href=["']\/?favicon\.svg(?:[?#][^"']*)?["']/i,
      `${page} must declare /favicon.svg`,
    );
  }
});

test('post-survey loads extracted styles and behavior without inline handlers', () => {
  const html = fs.readFileSync(path.join(publicDirectory, 'post-survey.html'), 'utf8');

  assert.match(html, /<link\b[^>]*href=["']\/post-survey\.css["']/i);
  assert.match(html, /<script\b[^>]*src=["']\/post-survey\.js["'][^>]*><\/script>/i);
  assert.doesNotMatch(html, /<style\b|<script(?!\s+src=)|\sstyle=|\son\w+=/i);
});
