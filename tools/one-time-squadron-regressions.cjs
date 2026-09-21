const fs=require('node:fs');
function edit(file, old, replacement) { const source=fs.readFileSync(file,'utf8'); if(!source.includes(old)) throw Error(`Expected source segment missing: ${file}`); if(source.split(old).length!==2) throw Error(`Not unique: ${file}`); fs.writeFileSync(file,source.replace(old,replacement)); }
edit('functions/api/squadron-board.js',`function orderDorms(a, b) {\n  const rank = dorm => number(dorm.display_order || dorm.input_order || dorm.source_row_index || 0);\n  return rank(a) - rank(b) || String(a.dorm_name || '').localeCompare(String(b.dorm_name || ''));\n}`,`function orderDorms(a, b) {\n  // Match GateRecordDisplay: explicit Input order first, then stable SQL created_at order.\n  const rank = dorm => {\n    for (const key of ['display_order', 'input_order', 'source_row_index', 'row_index']) {\n      const value = dorm[key];\n      if (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))) return Number(value);\n    }\n    return null;\n  };\n  const left = rank(a), right = rank(b);\n  if (left !== null && right !== null && left !== right) return left - right;\n  if (left !== null && right === null) return -1;\n  if (left === null && right !== null) return 1;\n  return 0;\n}`);
edit('public/js/prc-dash-final-audit.js',`      column.querySelectorAll('[data-empty-state]').forEach(node => node.remove());\n      if (!count) {\n        const blank = document.createElement('div');\n        blank.className = 'gate-squadron-empty-message';\n        blank.dataset.emptyState = 'true';\n        blank.textContent = 'None';\n        column.appendChild(blank);\n      }`,`      const blank = column.querySelector('[data-empty-state]');\n      if (count && blank) blank.remove();\n      if (!count && !blank) {\n        const empty = document.createElement('div');\n        empty.className = 'gate-squadron-empty-message';\n        empty.dataset.emptyState = 'true';\n        empty.textContent = 'None';\n        column.appendChild(empty);\n      }`);
const path='tests/runtime/record-display-integrity.test.mjs';
let source=fs.readFileSync(path,'utf8');
const start=source.indexOf('  for (const [name, contents] of Object.entries({ status, processing, squadron })) {');
const end=source.indexOf('\n});\n\ntest(\'Input owns dorm identity',start);
if(start<0||end<=start) throw Error('Canonical dorm ownership regression contract markers not found');
const replacement=String.raw`  for (const [name, contents] of Object.entries({ status, processing })) {
    assert.match(contents, /GateRecordDisplay/);
    assert.match(contents, /sortDorms/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(a\.dorm_name/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(b\.dorm_name/);
    assert.ok(contents.length > 500, name + ' source should be present');
  }
  // Squadron consumes the restricted server snapshot; never loads a second copy of raw records.
  assert.match(squadron, /\/api\/squadron-board/);
  assert.match(squadron, /function renderDormCards\(board\)/);
  assert.doesNotMatch(squadron, /function dormsForActiveWeek|function recordsByType/);`;
source=source.slice(0,start)+replacement+source.slice(end);
fs.writeFileSync(path,source);
console.log('Applied stable SQL order, stable empty states and shared Squadron ownership regression.');
