import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { onRequestPost as login } from '../../functions/api/login.js';
import { verifyRequestSession } from '../../functions/api/session-contract.mjs';
import { onRequest as middleware } from '../../functions/_middleware.js';

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

test('login client validates deep-link destinations by authenticated role', async () => {
  const loginHtml = await source('public/login/index.html');

  assert.match(loginHtml, /async function request\(url, options\)/);
  assert.match(loginHtml, /credentials:\s*'same-origin'/);
  assert.match(loginHtml, /await request\('\/api\/login'/);
  assert.match(loginHtml, /await request\('\/api\/session'/);
  assert.match(loginHtml, /const RETURN_ROUTES = Object\.freeze/);
  assert.match(loginHtml, /'\/processing\/': Object\.freeze\(\['admin', 'instructor', 'airman'\]\)/);
  assert.match(loginHtml, /'\/squadron\/': Object\.freeze\(\['squadron'\]\)/);
  assert.match(loginHtml, /const requested = new URLSearchParams\(window\.location\.search\)\.get\('returnTo'\)/);
  assert.match(loginHtml, /RETURN_ROUTES\[requested\]\?\.includes\(role\) \? requested : fallback/);
  assert.match(loginHtml, /window\.location\.replace\(destinationForRole\(session\.role\)\)/);
  assert.match(loginHtml, /role === 'squadron' \? '\/squadron\/' : '\/board\/'/);
  assert.match(loginHtml, /Unable to reach the authentication service/);
});

test('middleware preserves durable app routes across refresh and enforces role boundaries', async () => {
  const index = await source('public/index.html');
  const env = {
    AUTH_SECRET:'route-contract-secret',
    MTI_USERNAME:'mti-route',
    MTI_PASSWORD:'mti-password',
    AIRMAN_USERNAME:'airman-route',
    AIRMAN_PASSWORD:'airman-password',
    SQUADRON_USERNAME:'squadron-route',
    SQUADRON_PASSWORD:'squadron-password'
  };

  async function cookie(username, password) {
    const response = await login({
      env,
      request:new Request('https://gate.example/api/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,password})
      })
    });
    assert.equal(response.status,200);
    return response.headers.get('set-cookie').split(';')[0];
  }

  const instructorCookie = await cookie(env.MTI_USERNAME, env.MTI_PASSWORD);
  const airmanCookie = await cookie(env.AIRMAN_USERNAME, env.AIRMAN_PASSWORD);
  const squadronCookie = await cookie(env.SQUADRON_USERNAME, env.SQUADRON_PASSWORD);

  async function request(path, authCookie = '', assetBody = index) {
    let assetPath = null;
    const response = await middleware({
      env,
      request:new Request(`https://gate.example${path}`, {
        headers: authCookie ? { Cookie:authCookie } : {}
      }),
      next:async input => {
        assetPath = input ? new URL(input.url).pathname : path;
        return new Response(assetBody, {headers:{'Content-Type':'text/html; charset=UTF-8'}});
      }
    });
    return { response, assetPath };
  }

  const processing = await request('/processing/', instructorCookie);
  assert.equal(processing.response.status,200);
  assert.equal(processing.assetPath,'/', 'deep route must rewrite to the existing root app asset rather than duplicate HTML');
  assert.equal(processing.response.headers.get('cache-control'),'no-store');
  const processingHtml = await processing.response.text();
  assert.match(processingHtml, /data-gate-initial-route="processing"/);
  assert.match(processingHtml, /data-gate-session-role="instructor"/);
  assert.match(processingHtml, /id="page-processing" class="[^"]*\bactive\b/);
  assert.doesNotMatch(processingHtml, /id="page-board" class="[^"]*\bactive\b/);

  const airmanProcessing = await request('/processing/', airmanCookie);
  assert.equal(airmanProcessing.response.status,200);
  assert.match(await airmanProcessing.response.text(), /data-gate-session-role="airman"/);

  const blockedAirman = await request('/airport/', airmanCookie);
  assert.equal(blockedAirman.response.status,302);
  assert.equal(blockedAirman.response.headers.get('location'),'https://gate.example/board/');

  const blockedSquadron = await request('/processing/', squadronCookie);
  assert.equal(blockedSquadron.response.status,302);
  assert.equal(blockedSquadron.response.headers.get('location'),'https://gate.example/squadron/');

  const unauthenticated = await request('/processing/');
  assert.equal(unauthenticated.response.status,302);
  assert.equal(unauthenticated.response.headers.get('location'),'https://gate.example/login/?returnTo=%2Fprocessing%2F');

  const canonical = await request('/processing', instructorCookie);
  assert.equal(canonical.response.status,302);
  assert.equal(canonical.response.headers.get('location'),'https://gate.example/processing/');

  const rootEntry = await request('/', instructorCookie);
  assert.equal(rootEntry.response.status,302);
  assert.equal(rootEntry.response.headers.get('location'),'https://gate.example/board/');

  const instructorStandaloneSquadron = await request('/squadron/', instructorCookie);
  assert.equal(instructorStandaloneSquadron.response.status,302);
  assert.equal(instructorStandaloneSquadron.response.headers.get('location'),'https://gate.example/squadron-board/');

  const instructorSquadronBoard = await request('/squadron-board/', instructorCookie);
  assert.equal(instructorSquadronBoard.response.status,200);
  const instructorSquadronHtml = await instructorSquadronBoard.response.text();
  assert.match(instructorSquadronHtml, /data-gate-initial-route="squadron"/);
  assert.doesNotMatch(instructorSquadronHtml, /id="page-board" class="[^"]*\bactive\b/);
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


test('modern glass login keeps the exact authentication form, monitored-use notice, and single CSS owner', async () => {
  const html = await source('public/login/index.html');
  const css = await source('public/css/military-glass-terminal.css');
  const middleware = await source('functions/_middleware.js');
  for (const id of ['login-form','username','password','login-submit','login-message','login-title']) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, 'Missing or duplicated login contract: ' + id);
  }
  assert.match(html, /type="text" autocomplete="username"/);
  assert.match(html, /type="password" autocomplete="current-password"/);
  assert.match(html, /id="login-message" role="alert" aria-live="polite"/);
  assert.match(html, /login-submit-frame/);
  assert.match(html, /GOVERNMENT NOTICE/);
  assert.match(html, /AUTHORIZED USE ONLY/);
  assert.doesNotMatch(html, /Authorized Reception Center personnel only/);
  assert.doesNotMatch(html, /login-brand-mark|login-brand-topline/);
  assert.ok(html.indexOf('>GATE</p>') < html.indexOf('>GATEWAY ARRIVAL TRACKING ENVIRONMENT</p>'));
  assert.ok(html.indexOf('>GATEWAY ARRIVAL TRACKING ENVIRONMENT</p>') < html.indexOf('>PFINGSTON RECEPTION CENTER</p>'));
  assert.ok(html.indexOf('>PFINGSTON RECEPTION CENTER</p>') < html.indexOf('>Sign In</h1>'));
  assert.match(html, /Enter your credentials to enter/);
  assert.ok(html.indexOf('id="login-submit"') < html.indexOf('GOVERNMENT NOTICE'));
  assert.match(html, /may be monitored, recorded, and audited/);
  assert.match(html, /Do not enter CUI or PII/);
  assert.doesNotMatch(html, /Command Access|login-identity-strip|Beta Test v3/);
  assert.match(html, /\/css\/military-glass-terminal\.css\?v=login-watermark-20261017-v2/);
  assert.match(css, /\.login-submit-frame::before\s*\{[^}]*animation:\s*gate-login-button-orbit 7\.5s linear infinite/);
  assert.match(css, /body\.login-page::before\s*\{[^}]*background:\s*url\('\/assets\/gate_emblem_white\.png'\)/);
  assert.match(css, /body\.login-page::before\s*\{[^}]*opacity:\s*\.065/);
  assert.doesNotMatch(css, /\.login-brand-mark|\.login-brand-topline/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.login-submit-frame::before\s*\{\s*animation:\s*none/);
  assert.doesNotMatch(css, /login-identity-strip|login-card-surface/);
  assert.doesNotMatch(html, /<script\s+src=/);
  assert.match(middleware, /pathname === '\/login\/'/);
  assert.match(html, /if \(event\.persisted\) setBusy\(false\)/);
  assert.match(html, /if \(submit\.disabled\) return/);
});

test('Chromium validates responsive glass login geometry, visual focus, and orbit under Night/Day', async () => {
  const chrome = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
    .filter(Boolean).find(exe => spawnSync(exe, ['--version'], {encoding:'utf8', timeout:3000}).status === 0);
  assert.ok(chrome, 'Chromium is required to verify actual responsive login geometry');
  const styleUrl = pathToFileURL(resolve(root, 'public/css/military-glass-terminal.css')).href;
  const html = (await source('public/login/index.html'))
    .replace(/<link rel="preconnect"[^>]*>\n/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '')
    .replace('/css/military-glass-terminal.css?v=login-watermark-20261017-v2', styleUrl);
  const measure = [
    '(function(){',
    'const $=s=>document.querySelector(s);',
    'const rect=e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};',
    'const input=$("#username"),pass=$("#password"),button=$("#login-submit");',
    'const card=$(".login-card"),brand=$(".login-brand-stack"),intro=$(".login-introduction"),form=$("#login-form"),notice=$(".login-use-notice"),frame=$(".login-submit-frame");',
    'input.focus();',
    'const focus=getComputedStyle(input);',
    'const out={viewport:innerWidth,docWidth:document.documentElement.scrollWidth,card:rect(card),',
    ' brand:rect(brand),intro:rect(intro),form:rect(form),notice:rect(notice),',
    ' input:rect(input),password:rect(pass),button:rect(button),frame:rect(frame),',
    ' buttonText:button.textContent.trim(),buttonAnimation:getComputedStyle(frame,"::before").animationName,',
    ' buttonDisabled:button.disabled,inputType:input.type,passwordType:pass.type,',
    ' watermark:getComputedStyle(document.body,"::before").backgroundImage,',
    ' watermarkOpacity:parseFloat(getComputedStyle(document.body,"::before").opacity),',
    ' logoCount:document.querySelectorAll(".login-brand-mark").length,',
    ' glass:getComputedStyle(card).backdropFilter,cardBg:getComputedStyle(card).backgroundColor,',
    ' border:getComputedStyle(card).borderTopWidth,focusOutline:focus.outlineStyle};',
    'document.getElementById("gate-measurements").textContent=JSON.stringify(out);',
    '})();'
  ].join('\n');
  const dir = await mkdtemp(join(tmpdir(),'gate-login-glass-'));
  try {
    const fixture = join(dir, 'login.html');
    for (const [width,height] of [[360,740],[390,844],[768,1024],[1440,900],[1024,600]]) {
      for (const theme of ['night','day']) {
        const page=html.replace('<body class="login-page">', '<body class="login-page'+
          (theme === 'day' ? ' theme-light' : '')+'">')
          .replace('</body>','<pre id="gate-measurements"></pre><script>'+measure+'</script></body>');
        await writeFile(fixture,page,'utf8');
        const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
          '--disable-background-networking','--no-first-run','--user-data-dir='+join(dir,'chrome-'+width+'-'+theme),
          '--window-size='+width+','+height,'--dump-dom',pathToFileURL(fixture).href],
          {encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
        assert.equal(run.status,0,width+'/'+theme+' Chromium failed: '+String(run.stderr||'').slice(-300));
        const match=run.stdout.match(/<pre id="gate-measurements">([^<]+)<\/pre>/);
        assert.ok(match,width+'/'+theme+' missing computed UI geometry');
        const a=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
        const where=width+'/'+theme;
        assert.ok(a.docWidth<=a.viewport+1,where+' viewport overflows horizontally');
        assert.ok(a.card.x>=-1 && a.card.right<=a.viewport+1,where+' card outside viewport');
        assert.ok(a.card.width<=501,where+' login card is too wide');
        assert.ok(a.brand.bottom<=a.intro.y+1 && a.intro.bottom<=a.form.y+1,where+' heading and form overlap');
        assert.ok(a.form.bottom<=a.notice.y+1,where+' form overlaps authorized-use notice');
        assert.ok(a.input.height>=44 && a.password.height>=44 && a.button.height>=44,
          where+' inputs or button below accessible touch dimensions');
        assert.ok(a.input.x>=a.card.x && a.password.right<=a.card.right+1,where+' inputs overflow card');
        assert.ok(a.frame.y<=a.button.y+2 && a.button.bottom<=a.frame.bottom+1,where+' button ring misplaced');
        assert.equal(a.buttonText,'Sign In');
        assert.equal(a.buttonDisabled,false);
        assert.equal(a.buttonAnimation,'gate-login-button-orbit',where+' halo not animated');
        assert.ok(a.watermark.includes('gate_emblem_white.png'),where+' full GATE watermark is missing');
        assert.ok(a.watermarkOpacity>0 && a.watermarkOpacity<=0.09,where+' watermark too prominent or invisible');
        assert.equal(a.logoCount,0,where+' obsolete card emblem is still present');
        assert.equal(a.inputType,'text');
        assert.equal(a.passwordType,'password');
        assert.ok(a.glass!=='none',where+' glass surface absent');
        assert.ok(a.border!=='0px',where+' card boundary missing');
        assert.equal(a.focusOutline,'solid',where+' keyboard focus styling absent');
      }
    }
  } finally {
    await rm(dir, {recursive:true, force:true});
  }
});
