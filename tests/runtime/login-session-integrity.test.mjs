import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { onRequestPost as login } from '../../functions/api/login.js';
import { verifyRequestSession } from '../../functions/api/session-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('authentication fails closed without AUTH_SECRET and has no fallback signing secret', async () => {
  const loginApi = await source('functions/api/login.js');
  const sessionApi = await source('functions/api/session.js');
  const sessionContract = await source('functions/api/session-contract.mjs');
  const middleware = await source('functions/_middleware.js');

  for (const content of [loginApi, sessionApi, sessionContract, middleware]) {
    assert.doesNotMatch(content, /missing-secret/);
    assert.doesNotMatch(content, /SESSION_SECRET_FALLBACK/);
  }

  const response = await login({
    request: new Request('https://gate.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'any', password: 'any' })
    }),
    env: {}
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'configuration_required');
});

test('Squadron credentials create a signed squadron session only when configured', async () => {
  const env = {
    AUTH_SECRET: 'auth-secret-for-tests',
    SQUADRON_USERNAME: 'squadron_access',
    SQUADRON_PASSWORD: 'squadron-password'
  };
  const response = await login({
    request: new Request('https://gate.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'squadron_access', password: 'squadron-password' })
    }),
    env
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.role, 'squadron');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  const token = cookie.match(/prc_sr_session=([^;]+)/)?.[1];
  const session = await verifyRequestSession(new Request('https://gate.example/', {
    headers: { Cookie: `prc_sr_session=${token}` }
  }), env);
  assert.equal(session.role, 'squadron');
  assert.equal(session.username, 'squadron_access');
});

test('unconfigured role credentials cannot authenticate by matching undefined values', async () => {
  const response = await login({
    request: new Request('https://gate.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', password: 'y' })
    }),
    env: { AUTH_SECRET: 'configured-secret' }
  });
  assert.equal(response.status, 401);
});

test('login client verifies the session and routes Squadron users only to the dedicated board', async () => {
  const loginHtml = await source('public/login/index.html');

  assert.match(loginHtml, /async function request\(url, options\)/);
  assert.match(loginHtml, /credentials:\s*'same-origin'/);
  assert.match(loginHtml, /await request\('\/api\/login'/);
  assert.match(loginHtml, /await request\('\/api\/session'/);
  assert.match(loginHtml, /session\.role === 'squadron' \? '\/squadron\/' : '\/'/);
  assert.match(loginHtml, /Unable to reach the authentication service/);
});


test('ambiguous shared credentials fail closed without changing the shared role model', async () => {
  const env = { AUTH_SECRET:'collision-secret', MTI_USERNAME:'shared', MTI_PASSWORD:'same-password',
    SQUADRON_USERNAME:'shared', SQUADRON_PASSWORD:'same-password' };
  const attempt = (username, password, config=env) => login({
    env:config, request:new Request('https://gate.example/api/login', { method:'POST',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,password}) })
  });
  const collision = await attempt('shared','same-password');
  assert.equal(collision.status,503);
  assert.equal((await collision.json()).code,'configuration_conflict');
  assert.equal(collision.headers.get('set-cookie'),null);
  const distinct = { ...env, SQUADRON_PASSWORD:'different-password' };
  const squadron = await attempt('shared','different-password',distinct);
  assert.equal((await squadron.json()).role,'squadron');
  const instructor = await attempt('shared','same-password',distinct);
  assert.equal((await instructor.json()).role,'instructor');
});

test('changing Squadron credentials revokes only Squadron sessions and never exposes credentials in cookies', async () => {
  const env = { AUTH_SECRET:'rotation-secret', SQUADRON_USERNAME:'squadron', SQUADRON_PASSWORD:'squadron-old',
    MTI_USERNAME:'instructor', MTI_PASSWORD:'mti-password' };
  async function authenticate(username,password,config=env) {
    const response = await login({ env:config, request:new Request('https://gate.example/api/login', {method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}) });
    assert.equal(response.status,200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    return new Request('https://gate.example/api/session',{headers:{Cookie:cookie}});
  }
  const oldSquadron=await authenticate('squadron','squadron-old');
  const instructor=await authenticate('instructor','mti-password');
  assert.equal((await verifyRequestSession(oldSquadron,env)).role,'squadron');
  const rotated={...env,SQUADRON_PASSWORD:'squadron-new'};
  assert.equal(await verifyRequestSession(oldSquadron,rotated),null);
  assert.equal((await verifyRequestSession(instructor,rotated)).role,'instructor');
  const newSquadron=await authenticate('squadron','squadron-new',rotated);
  assert.equal((await verifyRequestSession(newSquadron,rotated)).role,'squadron');
  const encoded=newSquadron.headers.get('Cookie');
  assert.ok(!encoded.includes('squadron-new') && !encoded.includes('rotation-secret'));
  assert.equal(await verifyRequestSession(newSquadron,{...rotated,SQUADRON_USERNAME:''}),null);
  assert.equal(await verifyRequestSession(newSquadron,{...rotated,AUTH_SECRET:''}),null);
});
