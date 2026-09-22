const fs = require('node:fs');
function edit(path, replacements, addition = '') {
  let text = fs.readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (text.split(before).length !== 2) throw new Error(`Missing or non-unique test anchor: ${path}: ${before.slice(0, 80)}`);
    text = text.replace(before, after);
  }
  fs.writeFileSync(path, text + addition);
}

edit('tests/build-2/server/squadron-security.test.mjs', [
  ["import { onRequest as rootMiddleware } from '../../../functions/_middleware.js';", "import { onRequest as rootMiddleware } from '../../../functions/_middleware.js';\nimport { roleSigningSecret } from '../../../functions/api/session-contract.mjs';"],
  ["async function sessionCookie(secret, role = 'squadron', username = 'squadron_access') {", "function credentials(secret) {\n  return { AUTH_SECRET: secret, MTI_USERNAME: 'mti', MTI_PASSWORD: 'mti-pass', AIRMAN_USERNAME: 'airman', AIRMAN_PASSWORD: 'airman-pass', SQUADRON_USERNAME: 'squadron_access', SQUADRON_PASSWORD: 'squadron-pass' };\n}\n\nasync function sessionCookie(secret, role = 'squadron', username = 'squadron_access') {"],
  ["new TextEncoder().encode(secret), { name: 'HMAC'", "new TextEncoder().encode(roleSigningSecret(role, credentials(secret))), { name: 'HMAC'"],
  ["const env = { AUTH_SECRET: secret };", "const env = credentials(secret);"],
  ["const env = { AUTH_SECRET: secret, GATE_PERSISTENCE_ENABLED: 'false' };", "const env = { ...credentials(secret), GATE_PERSISTENCE_ENABLED: 'false' };"],
]);

edit('tests/build-2/server/records-api.test.mjs', [
  ["import { verifyRequestSession } from '../../../functions/api/session-contract.mjs';", "import { roleSigningSecret, verifyRequestSession } from '../../../functions/api/session-contract.mjs';"],
  ["new TextEncoder().encode(secret), { name: 'HMAC'", "new TextEncoder().encode(roleSigningSecret('instructor', { AUTH_SECRET:secret, MTI_USERNAME:'tester', MTI_PASSWORD:'tester-pass' })), { name: 'HMAC'"],
  ["}), { AUTH_SECRET: secret });", "}), { AUTH_SECRET: secret, MTI_USERNAME:'tester', MTI_PASSWORD:'tester-pass' });"],
]);

edit('tests/build-2/server/persistence-audit.test.mjs', [
  ["import { onRequest as apiMiddleware } from '../../../functions/api/_middleware.js';", "import { onRequest as apiMiddleware } from '../../../functions/api/_middleware.js';\nimport { roleSigningSecret } from '../../../functions/api/session-contract.mjs';"],
  ["const env = { DB, GATE_PERSISTENCE_ENABLED:'true', AUTH_SECRET:'fixture-only' };", "const env = { DB, GATE_PERSISTENCE_ENABLED:'true', AUTH_SECRET:'fixture-only', MTI_USERNAME:'fixture-instructor', MTI_PASSWORD:'fixture-pass' };"],
  ["createHmac('sha256', env.AUTH_SECRET).update(body)", "createHmac('sha256', roleSigningSecret('instructor', env)).update(body)"],
]);

edit('tests/runtime/login-session-integrity.test.mjs', [], String.raw`

test('one shared login per role remains valid; duplicated cross-role credentials fail closed', async () => {
  const base = {
    AUTH_SECRET: 'collision-test-secret',
    MTI_USERNAME: 'mti', MTI_PASSWORD: 'mti-password',
    AIRMAN_USERNAME: 'airman', AIRMAN_PASSWORD: 'airman-password',
    SQUADRON_USERNAME: 'squadron', SQUADRON_PASSWORD: 'squadron-password'
  };
  const attempt = (env, username, password) => login({
    env, request: new Request('https://gate.example/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    })
  });
  for (const [role, username, password] of [
    ['instructor','mti','mti-password'], ['airman','airman','airman-password'], ['squadron','squadron','squadron-password']
  ]) {
    const response = await attempt(base, username, password);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).role, role);
  }
  for (const duplicate of [
    { SQUADRON_USERNAME: 'mti', SQUADRON_PASSWORD: 'mti-password' },
    { AIRMAN_USERNAME: 'mti', AIRMAN_PASSWORD: 'mti-password' },
    { SQUADRON_USERNAME: 'airman', SQUADRON_PASSWORD: 'airman-password' }
  ]) {
    const env = { ...base, ...duplicate };
    const username = duplicate.SQUADRON_USERNAME || duplicate.AIRMAN_USERNAME;
    const password = duplicate.SQUADRON_PASSWORD || duplicate.AIRMAN_PASSWORD;
    const response = await attempt(env, username, password);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'configuration_conflict');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const absent = await attempt({ AUTH_SECRET: base.AUTH_SECRET }, 'squadron', 'squadron-password');
  assert.equal(absent.status, 401);
});

test('rotating one shared-role credential revokes only its sessions, without new variables or accounts', async () => {
  const env = {
    AUTH_SECRET: 'rotation-test-secret',
    MTI_USERNAME: 'mti', MTI_PASSWORD: 'mti-password',
    AIRMAN_USERNAME: 'airman', AIRMAN_PASSWORD: 'airman-password',
    SQUADRON_USERNAME: 'squadron', SQUADRON_PASSWORD: 'squadron-password'
  };
  async function issue(username, password) {
    const response = await login({ env, request: new Request('https://gate.example/api/login', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ username, password })
    }) });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').match(/prc_sr_session=([^;]+)/)[1];
  }
  const squadron = await issue('squadron','squadron-password');
  const instructor = await issue('mti','mti-password');
  const airman = await issue('airman','airman-password');
  const session = (token, config = env) => verifyRequestSession(new Request('https://gate.example/api/session', {
    headers:{ Cookie:\`prc_sr_session=\${token}\` }
  }),config);
  assert.equal((await session(squadron)).role,'squadron');
  assert.equal((await session(instructor)).role,'instructor');
  assert.equal((await session(airman)).role,'airman');
  const rotated = { ...env, SQUADRON_PASSWORD:'new-squadron-password' };
  assert.equal(await session(squadron,rotated),null);
  assert.equal((await session(instructor,rotated)).role,'instructor');
  assert.equal((await session(airman,rotated)).role,'airman');
  assert.equal(await session(instructor,{ ...env, MTI_USERNAME:'new-mti' }),null);
  assert.equal(await session(airman,{ ...env, AIRMAN_PASSWORD:'' }),null);
  assert.equal(await session(squadron,{ ...env, AUTH_SECRET:'' }),null);
  // All old pre-rollout cookies signed with AUTH_SECRET alone are invalid.
  const [,body] = squadron.split('.');
  const encoder = new TextEncoder();
  const legacyKey = await crypto.subtle.importKey('raw',encoder.encode(env.AUTH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signatureBytes = await crypto.subtle.sign('HMAC',legacyKey,encoder.encode(body));
  const legacySignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  assert.equal(await session(\`\${body}.\${legacySignature}\`),null);
});
`));
console.log('Reconciled Squadron, records, persistence and login security regression fixtures.');
