const fs = require('node:fs');
function edit(path, patch) { const before=fs.readFileSync(path,'utf8'); const after=patch(before); if(after===before) throw Error(`No change: ${path}`); fs.writeFileSync(path,after); }
edit('functions/_middleware.js', text => {
  const extra = ',\n  \'<link rel="stylesheet" href="/css/squadron-board.css?v=squadron-board-20260921">\'';
  if(!text.includes(extra)) throw Error('Squadron duplicate stylesheet marker missing');
  text=text.replace(extra,'');
  const old='/js/prc-dash-final-audit.js?v=record-display-integrity-20260714';
  if(!text.includes(old)) throw Error('Squadron renderer asset marker missing');
  return text.replace(old,'/js/prc-dash-final-audit.js?v=squadron-sitrep-20260921');
});
edit('.github/workflows/build-2-gate-c-tests.yml',text=>{
  const old=`          if grep -q 'SQUADRON_USERNAME' functions/api/login.js; then\n            echo 'Gate C must not activate Squadron login.'\n            exit 1\n          fi`;
  if(!text.includes(old)) throw Error('Historical Gate C source check missing');
  return text.replace(old,`          # Gate C invariants remain; Squadron authentication is explicitly authorized in later Packages 04–05.\n          node --test tests/build-2/server/squadron-security.test.mjs`);
});
const css = String.raw`

/* GATE SQUADRON SITREP — isolated scope, shared canonical stylesheet. */
.gate-squadron-standalone { min-height:100vh; margin:0; color:var(--mg-text); background:var(--mg-bg); }
.gate-squadron-standalone .login-classification { position:static; padding:5px 16px; font-size:11px; letter-spacing:.08em; }
#page-squadron { color:var(--mg-text); min-width:0; }
#page-squadron *,#page-squadron *::before,#page-squadron *::after { box-sizing:border-box; }
#page-squadron .gate-squadron-view { display:grid; gap:clamp(10px,1.2vw,16px); width:100%; max-width:1600px; margin:0 auto; padding:clamp(12px,2vw,24px); }
#page-squadron .gate-squadron-topbar,#page-squadron .gate-squadron-metrics,#page-squadron .gate-squadron-column { border:1px solid var(--mg-border-glass); border-radius:14px; background:var(--mg-surface); box-shadow:var(--mg-shadow-soft); }
#page-squadron .gate-squadron-topbar { display:grid; grid-template-columns:minmax(92px,1fr) minmax(0,3fr) minmax(92px,1fr); align-items:start; gap:10px; padding:clamp(12px,2vw,22px); }
#page-squadron .gate-squadron-top-left { justify-self:start; }
#page-squadron .gate-squadron-heading { text-align:center; min-width:0; }
#page-squadron .gate-squadron-eyebrow { font-size:10px; letter-spacing:.09em; font-weight:700; color:var(--mg-text-muted); }
#page-squadron .gate-squadron-title { margin:5px 0; font-size:clamp(21px,2.8vw,36px); line-height:1.12; color:var(--mg-text); letter-spacing:.025em; }
#page-squadron .gate-squadron-week { font-size:12px; font-weight:700; color:var(--mg-accent); }
#page-squadron .gate-squadron-actions { justify-self:end; display:flex; flex-direction:column; align-items:flex-end; gap:7px; }
#page-squadron .gate-squadron-tag { display:inline-block; border:1px solid var(--mg-border-glass); background:var(--mg-surface-soft); color:var(--mg-text); font-size:10px; padding:4px 8px; border-radius:999px; font-weight:700; }
#page-squadron .gate-squadron-utility,#page-squadron .gate-squadron-information { min-height:38px; padding:6px 10px; cursor:pointer; border:1px solid var(--mg-border-strong); border-radius:8px; background:var(--mg-surface-soft); color:var(--mg-text); font-weight:700; font-size:11px; }
#page-squadron .gate-squadron-information { display:flex; align-items:center; gap:7px; min-width:38px; justify-content:center; }
#page-squadron .gate-squadron-information > span:first-child { display:grid; place-items:center; border:1px solid currentColor; width:19px; height:19px; border-radius:50%; }
#page-squadron .gate-squadron-new { color:var(--mg-ok-ink); font-weight:900; }
#page-squadron .gate-squadron-new[hidden],#page-squadron .gate-squadron-editor[hidden],#page-squadron .gate-squadron-tooltip[hidden] { display:none; }
#page-squadron .gate-squadron-information.has-notice { border-color:var(--mg-ok); box-shadow:0 0 0 2px rgba(var(--mg-ok-rgb),.22); color:var(--mg-ok-ink); animation:squadron-notice-pulse 700ms ease-in-out 3; }
@keyframes squadron-notice-pulse { 50% { background:rgba(var(--mg-ok-rgb),.28); box-shadow:0 0 0 6px rgba(var(--mg-ok-rgb),.16); } }
#page-squadron .gate-squadron-traffic { grid-column:1/-1; text-align:center; border-top:1px solid var(--mg-border-soft); padding-top:10px; display:grid; justify-items:center; gap:6px; }
#page-squadron .gate-squadron-traffic-title,#page-squadron .gate-squadron-metric-head { font-size:11px; letter-spacing:.07em; font-weight:800; display:flex; align-items:center; justify-content:center; gap:7px; color:var(--mg-text-soft); }
#page-squadron .gate-squadron-tempo-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:clamp(5px,1vw,12px); width:min(590px,100%); }
#page-squadron .gate-squadron-tempo-option { display:grid; justify-items:center; gap:3px; padding:8px 3px; border-radius:9px; border:1px solid var(--mg-border-soft); color:var(--mg-text-muted); background:var(--mg-surface-muted); opacity:.68; }
#page-squadron .gate-squadron-tempo-option span { font-size:clamp(14px,2vw,20px); white-space:nowrap; line-height:1.2; }
#page-squadron .gate-squadron-tempo-option strong { font-size:11px; letter-spacing:.04em; }
#page-squadron .gate-squadron-traffic[data-tempo="SLOW"] [data-rate="SLOW"] { opacity:1; border-color:var(--mg-ok); background:rgba(var(--mg-ok-rgb),.13); color:var(--mg-ok-ink); }
#page-squadron .gate-squadron-traffic[data-tempo="MEDIUM"] [data-rate="MEDIUM"] { opacity:1; border-color:var(--mg-yellow); background:var(--mg-surface-soft); color:var(--mg-text); }
#page-squadron .gate-squadron-traffic[data-tempo="HEAVY"] [data-rate="HEAVY"] { opacity:1; border-color:var(--mg-red); background:var(--mg-surface-soft); color:var(--mg-red); }
#page-squadron .gate-squadron-traffic[data-tempo="UNAVAILABLE"] .gate-squadron-tempo-option { opacity:.45; }
#page-squadron .gate-squadron-traffic-detail,#page-squadron .gate-squadron-status { font-size:12px; color:var(--mg-text-muted); text-align:center; }
#page-squadron .gate-squadron-status.is-error { color:var(--mg-red); }
#page-squadron .gate-squadron-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
#page-squadron .gate-squadron-metric { min-width:0; padding:clamp(10px,1.2vw,16px); text-align:center; }
#page-squadron .gate-squadron-metric + .gate-squadron-metric { border-left:1px solid var(--mg-border-soft); }
#page-squadron .gate-squadron-value { font-size:clamp(24px,3.2vw,40px); line-height:1.2; font-weight:800; margin-top:7px; color:var(--mg-text); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
#page-squadron .gate-squadron-value.is-time { font-size:clamp(17px,2.4vw,28px); }
#page-squadron .gate-squadron-columns { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:start; gap:clamp(9px,1vw,16px); }
#page-squadron .gate-squadron-column { min-width:0; overflow:visible; }
#page-squadron .gate-squadron-column-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:11px 12px; border-bottom:1px solid var(--mg-border-soft); font-size:12px; font-weight:800; }
#page-squadron .gate-squadron-column-head > span:first-child { display:flex; align-items:center; gap:7px; }
#page-squadron .gate-squadron-column-count { border-radius:999px; background:var(--mg-surface-soft); padding:4px 9px; font-size:12px; }
#page-squadron .gate-squadron-column-list { display:grid; gap:8px; padding:10px; }
#page-squadron .gate-squadron-dorm { min-width:0; border:1px solid var(--mg-border-glass); border-radius:9px; background:var(--mg-surface-strong); padding:10px 12px; }
#page-squadron .gate-squadron-dorm.is-female { border-color:var(--gate-flag-female-red,var(--mg-red)); }
#page-squadron .gate-squadron-dorm-top { display:flex; align-items:center; justify-content:space-between; gap:10px; overflow-wrap:anywhere; }
#page-squadron .gate-squadron-dorm-top [data-field="load"] { font-variant-numeric:tabular-nums; white-space:nowrap; font-weight:800; }
#page-squadron .gate-squadron-dorm-meta { margin-top:4px; color:var(--mg-text-soft); font-size:12px; }
#page-squadron .gate-squadron-dorm-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
#page-squadron .gate-squadron-dorm-tags:empty { display:none; }
#page-squadron .gate-squadron-empty-message { font-size:12px; color:var(--mg-text-muted); }
#page-squadron .gate-info { display:inline-grid; place-items:center; border:1px solid var(--mg-border-strong); border-radius:50%; min-height:26px; min-width:26px; padding:0; color:var(--mg-text); background:var(--mg-surface-soft); cursor:help; font-size:12px; font-weight:800; }
#page-squadron :is(.gate-info,.gate-squadron-utility,.gate-squadron-information,.gate-squadron-publish):focus-visible { outline:2px solid var(--mg-accent); outline-offset:3px; }
#page-squadron .gate-squadron-tooltip { position:fixed; z-index:5000; max-width:min(280px,calc(100vw - 24px)); padding:9px 11px; border-radius:8px; border:1px solid var(--mg-border-strong); box-shadow:var(--mg-shadow-strong); background:var(--mg-surface-strong); color:var(--mg-text); font-size:12px; line-height:1.45; }
#page-squadron .gate-squadron-dialog { position:fixed; margin:auto; width:min(550px,calc(100vw - 24px)); max-height:calc(100vh - 30px); overflow-y:auto; border:1px solid var(--mg-border-strong); border-radius:14px; padding:20px; background:var(--mg-bg-elevated); color:var(--mg-text); box-shadow:var(--mg-shadow-strong); }
#page-squadron .gate-squadron-dialog::backdrop { background:rgba(10,18,30,.72); }
#page-squadron .gate-squadron-dialog-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; }
#page-squadron .gate-squadron-dialog-heading h2 { margin:0; font-size:21px; }
#page-squadron .gate-squadron-instructions { margin-top:12px; line-height:1.5; }
#page-squadron .gate-squadron-instructions p { border-bottom:1px solid var(--mg-border-soft); padding:8px 0; margin:0; }
#page-squadron .gate-squadron-instructions a { color:var(--mg-accent); text-decoration:underline; }
#page-squadron .gate-squadron-notice { margin-top:14px; padding:12px; border:1px solid var(--mg-border-glass); border-radius:8px; background:var(--mg-surface-soft); }
#page-squadron .gate-squadron-notice h3 { margin:0 0 8px; font-size:13px; color:var(--mg-accent); }
#page-squadron #squadron-notice-message { white-space:pre-wrap; overflow-wrap:anywhere; }
#page-squadron .gate-squadron-notice-time { font-size:11px; margin-top:6px; color:var(--mg-text-muted); }
#page-squadron .gate-squadron-editor { display:grid; gap:9px; margin-top:14px; }
#page-squadron .gate-squadron-editor label { font-weight:800; font-size:12px; }
#page-squadron .gate-squadron-editor textarea { width:100%; border:1px solid var(--mg-border-glass); border-radius:8px; padding:9px; resize:vertical; color:var(--mg-text); background:var(--mg-field); }
#page-squadron .gate-squadron-publish { min-height:40px; border:1px solid var(--mg-accent); border-radius:8px; color:var(--mg-text); background:var(--mg-surface-soft); font-weight:800; cursor:pointer; }
@media(max-width:950px) { #page-squadron .gate-squadron-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } #page-squadron .gate-squadron-metric:nth-child(3) { border-left:0; } #page-squadron .gate-squadron-metric:nth-child(n+3) { border-top:1px solid var(--mg-border-soft); } #page-squadron .gate-squadron-columns { grid-template-columns:1fr; } }
@media(max-width:620px) { #page-squadron .gate-squadron-topbar { grid-template-columns:1fr auto; } #page-squadron .gate-squadron-heading { grid-column:1/-1; grid-row:1; padding-inline:36px; } #page-squadron .gate-squadron-top-left { grid-column:1; grid-row:1; z-index:1; } #page-squadron .gate-squadron-actions { grid-column:2; grid-row:1; z-index:1; } #page-squadron .gate-squadron-actions .gate-squadron-tag { display:none; } #page-squadron .gate-squadron-traffic { grid-row:2; } #page-squadron .gate-squadron-view { padding:8px; } #page-squadron .gate-squadron-metric { padding:10px 8px; } #page-squadron .gate-squadron-tempo-option { padding:7px 1px; } #page-squadron .gate-squadron-value.is-time { font-size:17px; } }
@media(prefers-reduced-motion:reduce) { #page-squadron .gate-squadron-information.has-notice { animation:none; } }
`;
edit('public/css/military-glass-terminal.css',text=>{
  if(text.includes('/* GATE SQUADRON SITREP')) throw Error('Squadron rules already appended');
  return text+css;
});
console.log('Applied Squadron-only styles; retained one canonical stylesheet, current Flight Alert fixes and Gate C invariants.');
