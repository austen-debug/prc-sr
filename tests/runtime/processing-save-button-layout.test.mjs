import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../public/js/prc-dash-auditorium-location.js',import.meta.url),'utf8');

test('Processing assignment Save button has a contained two-state presentation without replacing its handler',()=>{
 const start=source.indexOf('const saveButton = flex.querySelector');
 const end=source.indexOf('return input;',start);
 assert.ok(start>=0 && end>start);
 const presentation=source.slice(start,end);
 assert.match(presentation,/saveButton\.style\.boxSizing = 'border-box'/);
 assert.match(presentation,/saveButton\.style\.width = '100%'/);
 assert.match(presentation,/saveButton\.style\.minWidth = '0'/);
 assert.match(presentation,/saveButton\.style\.maxWidth = '100%'/);
 assert.match(presentation,/saveButton\.style\.minHeight = '44px'/);
 assert.match(presentation,/saveButton\.style\.fontSize = '\.69rem'/);
 assert.match(presentation,/saveButton\.style\.whiteSpace = 'nowrap'/);
 assert.match(source,/button\.textContent = 'SAVING\.\.\.'/);
 assert.match(source,/window\.saveAssignedAirman = saveProcessingAssignmentAndLocation/);
 assert.match(source,/controller\.updateDorm\(payload, \{ source: 'processing-assignment-location-update' \}\)/);
 assert.match(source,/if \(getModalDormIdSafe\(\) === boundId\) controller\.closeDormModal\?\.\(\)/);
});
