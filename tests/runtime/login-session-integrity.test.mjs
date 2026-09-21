import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
async function source(path) { return readFile(resolve(root,path),'utf8'); }

test('login, session and HTML guard use the shared fail-closed signer, never a fallback key', async () => {
  const login = await source('functions/api/login.js');
  const session = await source('functions/api/session.js');
  const contract = await source('functions/api/session-contract.mjs');
  const guard = await source('functions/_middleware.js');
  const shell = await source('functions/gate-shell-legacy.mjs');
  for (const value of [login,session,contract,guard]) assert.doesNotMatch(value,/missing-secret|SESSION_SECRET_FALLBACK/);
  assert.match(contract,/crypto\.subtle\.verify/);
  assert.match(contract,/env\.AUTH_SECRET\.length >= 32/);
  assert.match(login,/issueSession/);
  assert.match(login,/SQUADRON_USERNAME/);
  assert.match(session,/verifyRequestSession/);
  assert.match(guard,/verifyRequestSession/);
  assert.match(guard,/session\.role === 'squadron'/);
  assert.match(guard,/renderLegacyShell/);
  assert.match(shell,/applyUiAssets/);
});

test('login verifies the session before entering GATE; HTML gate redirects Squadron by role', async () => {
  const login = await source('public/login/index.html');
  const guard = await source('functions/_middleware.js');
  assert.match(login,/await request\('\/api\/login'/);
  assert.match(login,/await request\('\/api\/session'/);
  assert.match(login,/if \(!session\.ok\)/);
  assert.match(guard,/new URL\('\/squadron\/'/);
  assert.match(login,/window\.location\.replace\('\/'\)/);
});
