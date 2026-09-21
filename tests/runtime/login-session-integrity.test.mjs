import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('login creation and all verification paths share the same fallback session secret', async () => {
  const loginApi = await source('functions/api/login.js');
  const sessionApi = await source('functions/api/session.js');
  const sessionContract = await source('functions/api/session-contract.mjs');
  const middleware = await source('functions/_middleware.js');

  assert.match(loginApi, /SESSION_SECRET_FALLBACK\s*=\s*'missing-secret'/);
  assert.match(loginApi, /env\.AUTH_SECRET\s*\|\|\s*SESSION_SECRET_FALLBACK/);
  assert.match(sessionApi, /SESSION_SECRET_FALLBACK\s*=\s*'missing-secret'/);
  assert.match(sessionApi, /env\.AUTH_SECRET\s*\|\|\s*SESSION_SECRET_FALLBACK/);
  assert.match(sessionContract, /secret\s*\|\|\s*'missing-secret'/);
  assert.match(middleware, /secret\s*\|\|\s*'missing-secret'/);
});

test('login client sends same-origin credentials on both requests and verifies the session before entering GATE', async () => {
  const loginHtml = await source('public/login/index.html');

  assert.match(loginHtml, /async function request\(url, options\)/);
  assert.match(loginHtml, /return await fetch\(url,\s*\{\s*credentials:\s*'same-origin',\s*\.\.\.options,\s*signal:\s*controller\.signal\s*\}\)/);
  assert.match(loginHtml, /await request\('\/api\/login'/);
  assert.match(loginHtml, /await request\('\/api\/session'/);
  assert.match(loginHtml, /if \(!session\.ok\)/);
  assert.match(loginHtml, /window\.location\.replace\('\/'\)/);
  assert.match(loginHtml, /catch \(error\)[\s\S]*Unable to reach the authentication service/);
});
