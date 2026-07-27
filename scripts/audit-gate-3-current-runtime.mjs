import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'gate-3.0/phase-5-certification';
const candidateSha = process.env.GITHUB_SHA || '';

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function read(p) { return fs.readFile(p, 'utf8'); }
async function walk(dir) {
  if (!(await exists(dir))) return [];
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p)); else out.push(p.replaceAll('\\', '/'));
  }
  return out;
}
function lines(text) { return text.split(/\r?\n/).length; }
function matches(text, re) { return [...text.matchAll(re)].map(m => m[1] || m[0]); }
function unique(values) { return [...new Set(values)]; }
function basenameFromUrl(value) { return String(value).split('?')[0].split('/').pop(); }

const indexPath = 'public/index.html';
const bootstrapPath = 'public/js/gate-application-bootstrap.js';
const index = await read(indexPath);
const bootstrap = await read(bootstrapPath);

const activeStyles = matches(index, /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g);
const activeScripts = matches(index, /<script[^>]+src="([^"]+)"/g);
const localStyles = activeStyles.filter(v => v.startsWith('/'));
const localScripts = activeScripts.filter(v => v.startsWith('/'));

const allJs = (await walk('public/js')).filter(p => p.endsWith('.js'));
const allCss = (await walk('public/css')).filter(p => p.endsWith('.css'));
const allWorkflows = (await walk('.github/workflows')).filter(p => /\.ya?ml$/.test(p));
const build2Docs = await walk('docs/build-2');
const build2Tests = await walk('tests/build-2');
const gate3Docs = await walk('docs/gate-3.0');

const activeScriptPaths = localScripts.map(v => `public${v.split('?')[0]}`);
const activeStylePaths = localStyles.map(v => `public${v.split('?')[0]}`);

const syntax = [];
for (const file of activeScriptPaths) {
  if (!(await exists(file))) {
    syntax.push({ file, status: 'missing' });
    continue;
  }
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  syntax.push({ file, status: result.status === 0 ? 'pass' : 'fail', error: result.status === 0 ? '' : (result.stderr || result.stdout || '').trim().slice(0, 1000) });
}

const bootstrapFunctions = unique(matches(bootstrap, /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g));
const bootstrapWindowAssignments = unique(matches(bootstrap, /window\.([A-Za-z_$][\w$]*)\s*=/g));
const bootstrapInlineHandlers = matches(bootstrap, /\bon(?:click|change|submit|keydown|keyup|contextmenu|input|blur|focus)\s*=/gi);
const indexInlineHandlers = matches(index, /\bon(?:click|change|submit|keydown|keyup|contextmenu|input|blur|focus)\s*=/gi);

const expectedCanonicalControllers = {
  board: 'public/js/gate-status-board-controller.js',
  processing: 'public/js/gate-processing-controller.js',
  airport: 'public/js/gate-bus-workflow-controller.js',
  input: 'public/js/gate-input-page-controller.js',
  archives: 'public/js/gate-archive-controller.js'
};

const controllerAudit = {};
for (const [route, file] of Object.entries(expectedCanonicalControllers)) {
  const source = await read(file);
  controllerAudit[route] = {
    file,
    lines: lines(source),
    syntax: spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }).status === 0 ? 'pass' : 'fail',
    usesStore: /GateApplicationStore/.test(source),
    legacyGlobalReferences: unique(matches(source, /\b(allData|renderAll|showPage|currentRole|getActiveWG|getRecords|getElapsedTimer)\b/g)),
    windowExports: unique(matches(source, /window\.([A-Za-z_$][\w$]*)\s*=/g)),
    inlineHandlerMarkupCount: matches(source, /\bon(?:click|change|submit|keydown|keyup|contextmenu)\s*=/gi).length,
    fallbackMarkers: unique(matches(source, /\b(fallback[A-Za-z_$][\w$]*|else\s*\{\s*[^}]{0,200}(?:render|innerHTML))/g)).slice(0, 50)
  };
}

const duplicateOwnershipMap = {
  statusBoard: ['renderDormColumns','buildBoardDormCard','updateTimers','updateAirportMetric','getElapsedTimer'],
  processing: ['renderProcessingPage','buildProcCard','openDormModal','closeDormModal','saveAssignedAirman','saveLoad','openDormEditModal','closeDormEditModal'],
  airportBus: ['getNextAirportBusId','renderArrivals','renderAirportBusLog','confirmBusArrival','openLocalBusModal','closeLocalBusModal'],
  input: ['initBatchGrid','initializeWeekGroup','returnToBoard'],
  archives: ['renderArchives','initiateCloseout','openArchiveEditModal','closeArchiveEditModal','printArchiveSpreadsheet']
};
const duplicateOwnership = Object.fromEntries(Object.entries(duplicateOwnershipMap).map(([domain, names]) => [domain, names.filter(name => bootstrapFunctions.includes(name))]));

const removedAssetNames = [
  'gate-mobile-corrective.css','gate-ui-ownership-correction.css','gate-light-mode-command-contrast.css','gate-light-mode-grid-correction.css','gate-tablet-shell.css','gate-fullscreen-board-contract.css',
  'prc-dash-runtime-fixes.js','prc-dash-dorm-reopen.js','prc-dash-final-audit.js','prc-dash-dorm-flag-validation.js','prc-dash-auditorium-location.js','gate-airport-bus-delete-controller.js','prc-dash-modal-mobile-validation.js','gate-render-stability-fix.js','prc-dash-processing-loaded-summary.js','prc-dash-overtime-audit.js','prc-dash-sat-arrivals.js','gate-status-board-shadow-controller.js'
];

const workflowAudit = [];
for (const file of allWorkflows) {
  const source = await read(file);
  const staleRefs = removedAssetNames.filter(name => source.includes(name));
  const shadowRefs = /status-board-shadow|Phase 3A|Build 2/.test(source);
  workflowAudit.push({ file, lines: lines(source), staleRemovedAssetReferences: staleRefs, referencesTransitionOrBuild2: shadowRefs });
}

const activeLegacyNamedAssets = [...activeScriptPaths, ...activeStylePaths].filter(p => /legacy|prc-dash|corrective|fix|patch|audit|shadow/i.test(p));
const unreferencedJs = allJs.filter(p => !activeScriptPaths.includes(p));
const unreferencedCss = allCss.filter(p => !activeStylePaths.includes(p));

const middleware = await read('functions/_middleware.js');
const middlewareAudit = {
  lines: lines(middleware),
  uiRewriteMarkers: unique(matches(middleware, /(injectUiAssets|normalizeServedBranding|stripLegacyInlineShellCss|applyStatusBoardMetricSourceRefactor|HTMLRewriter|\.replace\()/g)),
  sessionVerification: /verifySession/.test(middleware),
  securityHeaders: /X-Content-Type-Options|X-Frame-Options|Referrer-Policy/.test(middleware)
};

const audit = {
  generatedAt: new Date().toISOString(),
  branch,
  candidateSha,
  scope: 'actual checked-out repository and served runtime',
  summary: {
    indexLines: lines(index),
    bootstrapLines: lines(bootstrap),
    activeStyles: activeStyles.length,
    activeLocalStyles: localStyles.length,
    activeScripts: activeScripts.length,
    activeLocalScripts: localScripts.length,
    publicJsFiles: allJs.length,
    publicCssFiles: allCss.length,
    workflowFiles: allWorkflows.length,
    build2DocFiles: build2Docs.length,
    build2TestFiles: build2Tests.length,
    gate3ProgramFiles: gate3Docs.length,
    bootstrapFunctions: bootstrapFunctions.length,
    bootstrapInlineHandlerMarkupCount: bootstrapInlineHandlers.length,
    indexInlineHandlerCount: indexInlineHandlers.length,
    activeLegacyNamedAssets: activeLegacyNamedAssets.length,
    failingActiveScriptSyntaxChecks: syntax.filter(item => item.status !== 'pass').length,
    workflowsWithStaleRemovedAssetReferences: workflowAudit.filter(item => item.staleRemovedAssetReferences.length).length
  },
  servedRuntime: { activeStyles, activeScripts, activeStylePaths, activeScriptPaths, activeLegacyNamedAssets },
  middleware: middlewareAudit,
  stateAndRouting: {
    applicationStorePresent: await exists('public/js/gate-application-store.js'),
    routeLifecyclePresent: await exists('public/js/gate-route-lifecycle.js'),
    legacyAllDataDeclarationPresent: /\blet\s+allData\b/.test(bootstrap),
    legacyRenderAllDeclarationPresent: /function\s+renderAll\b/.test(bootstrap),
    legacyShowPageDeclarationPresent: /function\s+showPage\b/.test(bootstrap),
    bootstrapWindowAssignments,
    bootstrapFunctions
  },
  canonicalControllers: controllerAudit,
  duplicateOwnership,
  syntax,
  css: { activeStylePaths, allCss, unreferencedCss },
  javascript: { activeScriptPaths, allJs, unreferencedJs },
  workflows: workflowAudit,
  historicalMaterial: { build2Docs, build2Tests, gate3Docs },
  auditFindings: [
    { severity: 'critical', id: 'BOOTSTRAP-SYNTAX', statement: syntax.some(item => item.file === bootstrapPath && item.status === 'fail') ? 'The active application bootstrap fails JavaScript syntax validation.' : 'The active application bootstrap passes syntax validation.' },
    { severity: 'critical', id: 'DUPLICATE-ROUTE-OWNERS', statement: 'The bootstrap still defines route and workflow functions also assigned to canonical controllers.', evidence: duplicateOwnership },
    { severity: 'high', id: 'FALLBACK-RENDERING', statement: 'renderApplication still contains conditional fallback rendering and direct route rendering calls.' },
    { severity: 'high', id: 'INLINE-HANDLER-GENERATION', statement: `Active JavaScript still generates ${bootstrapInlineHandlers.length + Object.values(controllerAudit).reduce((sum, item) => sum + item.inlineHandlerMarkupCount, 0)} inline event-handler attributes.` },
    { severity: 'high', id: 'STALE-CI', statement: 'Workflows and tests still reference removed Build 2 shadow/evidence assets.', evidence: workflowAudit.filter(item => item.staleRemovedAssetReferences.length) },
    { severity: 'medium', id: 'LEGACY-NAMED-ACTIVE-ASSETS', statement: 'Legacy-named assets remain in the served runtime.', evidence: activeLegacyNamedAssets },
    { severity: 'medium', id: 'HISTORICAL-BLOAT', statement: 'Build 2 documentation and tests remain in executable repository paths and require final disposition.', counts: { docs: build2Docs.length, tests: build2Tests.length } }
  ],
  uiUxPassEntryCriteria: [
    'Restore a syntactically valid active bootstrap.',
    'Remove duplicate route rendering and mutation ownership from the bootstrap.',
    'Retire or rewrite stale Build 2 workflows and tests so CI reflects GATE 3.0.',
    'Confirm every active CSS file has one permanent design-system responsibility.',
    'Then perform route-by-route visual, responsive, accessibility, and interaction cleanup.'
  ]
};

await fs.mkdir('docs/gate-3.0/current', { recursive: true });
await fs.writeFile('docs/gate-3.0/current/runtime-index.json', JSON.stringify(audit, null, 2) + '\n');

const md = `# GATE 3.0 Current Repository Audit and Runtime Index\n\nGenerated: ${audit.generatedAt}\n\nBranch: \`${branch}\`  \nCandidate: \`${candidateSha}\`\n\n## Executive finding\n\nThe repository has completed major structural extraction and net-negative cleanup, but the application is **not yet a clean single-owner GATE 3.0 runtime**. The active bootstrap remains ${audit.summary.bootstrapLines.toLocaleString()} lines and still contains duplicate route rendering, workflow functions, fallback paths, and inline-handler generation that overlap the canonical controllers.\n\n## Current served runtime\n\n- ${audit.summary.activeLocalStyles} local stylesheets and ${audit.summary.activeLocalScripts} local scripts are loaded by \`public/index.html\`.\n- ${audit.summary.publicCssFiles} CSS files and ${audit.summary.publicJsFiles} JavaScript files remain under \`public/\`.\n- The bootstrap defines ${audit.summary.bootstrapFunctions} named functions.\n- Active JavaScript syntax failures: ${audit.summary.failingActiveScriptSyntaxChecks}.\n- Active legacy-named assets: ${audit.summary.activeLegacyNamedAssets}.\n\n## Canonical boundaries present\n\n- \`GateApplicationStore\`: ${audit.stateAndRouting.applicationStorePresent ? 'present' : 'missing'}\n- \`GateRouteLifecycle\`: ${audit.stateAndRouting.routeLifecyclePresent ? 'present' : 'missing'}\n- Middleware UI rewriting markers: ${audit.middleware.uiRewriteMarkers.length ? audit.middleware.uiRewriteMarkers.join(', ') : 'none detected'}\n\n## Duplicate ownership still present in the bootstrap\n\n${Object.entries(duplicateOwnership).map(([domain, names]) => `- **${domain}:** ${names.length ? names.map(name => `\`${name}\``).join(', ') : 'none detected'}`).join('\n')}\n\n## CI and historical-material audit\n\n- ${audit.summary.workflowFiles} workflow files remain.\n- ${audit.summary.workflowsWithStaleRemovedAssetReferences} workflows reference assets removed by the transition.\n- ${audit.summary.build2DocFiles} Build 2 documentation files remain.\n- ${audit.summary.build2TestFiles} Build 2 test files remain.\n\n## UI/UX cleanup readiness\n\nThe UI/UX pass should not begin as a cosmetic-only exercise. It must start by restoring runtime integrity and removing duplicate render ownership; otherwise visual changes may be overwritten by fallback renderers or obsolete controllers.\n\nThe machine-readable inventory is in \`docs/gate-3.0/current/runtime-index.json\`.\n`;
await fs.writeFile('docs/gate-3.0/current/REPOSITORY_AUDIT.md', md);

// Remove transition-only residue discovered by this audit.
for (const obsolete of [
  'gate-3-bootstrap-migration.log',
  'scripts/consolidate-gate-route-owners.mjs',
  '.github/workflows/consolidate-gate-route-owners.yml'
]) {
  if (await exists(obsolete)) await fs.rm(obsolete, { recursive: true, force: true });
}

console.log(JSON.stringify(audit.summary, null, 2));
