import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const metrics = readFileSync(new URL('../../public/js/gate-premium-metrics-controller.js', import.meta.url), 'utf8');
const board = readFileSync(new URL('../../public/js/gate-status-board-controller.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../public/js/gate-app-shell-controller.js', import.meta.url), 'utf8');
const mobile = readFileSync(new URL('../../public/js/gate-mobile-app-shell-finalizer.js', import.meta.url), 'utf8');

const begin = html.indexOf('    function getBoardWeekState() {');
const end = html.indexOf('    function getBoardWG() {', begin + 1);
assert.ok(begin > 0 && end > begin, 'server-rendered application must expose board reconciliation state');
const stateFn = new Function('allData', 'getActiveWG', 'window', html.slice(begin, end) + '\nreturn getBoardWeekState();');
const getState = (records, active, server={}) => stateFn(records, active, {gateCloseoutRecovery:null,...server});

const config = (time, value='WG27003') => ({ type:'config', key:'week_group', value, updated_at:time });
const archived = (time, group='WG27003') => ({ type:'archive', week_group:group, archived_at:time });
const bus = (group='WG27003') => ({ type:'bus', week_group:group, status:'arrived', otw_count:858 });
const dorm = (group='WG27003') => ({ type:'dorm', week_group:group, current_load:0 });

test('archived group with no dorms is suppressed from live board, but recovery remains flagged', () => {
  const state=getState([config('2026-10-26T10:00:00Z'), archived('2026-10-27T11:09:00Z'), bus()], ()=>'WG27003');
  assert.deepEqual(state, {weekGroup:'',recoveryRequired:true,archivedWeekGroup:'WG27003'});
  assert.match(html, /CLOSEOUT REQUIRES RECONCILIATION/);
  assert.match(html, /boardState\.recoveryRequired \? 'CLOSEOUT PENDING'/);
});

test('live-only polling uses authoritative server recovery metadata without archived records', () => {
  const state=getState([config('2026-10-26T10:00:00Z'),bus()], ()=>'WG27003',
    {gateCloseoutRecovery:{recovery_required:true,week_group:'WG27003',residual_buses:27}});
  assert.deepEqual(state,{weekGroup:'',recoveryRequired:true,archivedWeekGroup:'WG27003'});
  assert.match(html,/window.gateCloseoutRecovery = result.closeout_recovery \|\| null/);
});

test('active group retains live visibility when its dorms exist', () => {
  const state=getState([config('2026-10-26T10:00:00Z'),archived('2026-10-27T11:09:00Z'),dorm(),bus()], ()=>'WG27003');
  assert.equal(state.weekGroup,'WG27003');
  assert.equal(state.recoveryRequired,false);
});

test('newer same-label cycle is not hidden by older historical archive', () => {
  const state=getState([config('2026-11-10T10:00:00Z'), archived('2026-10-27T11:09:00Z'), bus()], ()=>'WG27003');
  assert.equal(state.weekGroup,'WG27003');
  assert.equal(state.recoveryRequired,false);
});

test('without an archive, the board must not fabricate a closeout', () => {
  const state=getState([config('2026-10-26T10:00:00Z'),bus()], ()=>'WG27003');
  assert.equal(state.weekGroup,'WG27003');
  assert.equal(state.recoveryRequired,false);
});

test('all authoritative status-board metrics and dorm/bus render paths honor board reconciliation', () => {
  assert.match(metrics, /typeof getBoardWG === 'function' \? getBoardWG\(\)/);
  assert.match(board, /typeof getBoardWG === 'function' \? getBoardWG\(\)/);
  assert.match(html, /const wg = boardState\.weekGroup/);
  assert.match(shell, /typeof getBoardWG === 'function' \? getBoardWG\(\)/);
  assert.match(mobile, /\^CLOSEOUT PENDING\$/);
});

test('server recovery banner survives effective live config being blanked', () => {
  const state=getState([config('2026-10-26T10:00:00Z','')], ()=>'',
    {gateCloseoutRecovery:{recovery_required:true,week_group:'WG27003',residual_buses:27}});
  assert.deepEqual(state,{weekGroup:'',recoveryRequired:true,archivedWeekGroup:'WG27003'});
});
