import fs from 'node:fs/promises';

const INDEX_PATH = 'public/index.html';
const BOOTSTRAP_PATH = 'public/js/gate-application-bootstrap.js';
const STRUCTURE_CSS_PATH = 'public/css/gate-application-structure.css';
const STYLE_MARKER_START = '/* GATE 3 GENERATED INLINE STYLE CLASSES START */';
const STYLE_MARKER_END = '/* GATE 3 GENERATED INLINE STYLE CLASSES END */';

function decodeHtml(value) {
  return String(value || '')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function escapeJs(value) {
  return JSON.stringify(String(value));
}

let index = await fs.readFile(INDEX_PATH, 'utf8');
let bootstrap = await fs.readFile(BOOTSTRAP_PATH, 'utf8');
let structureCss = await fs.readFile(STRUCTURE_CSS_PATH, 'utf8');

const styleToClass = new Map();
let styleCounter = 0;
index = index.replace(/<([a-z][^>]*?)\sstyle="([^"]*)"([^>]*)>/gi, (match, before, styleValue, after) => {
  const normalized = decodeHtml(styleValue).trim();
  if (!styleToClass.has(normalized)) {
    styleCounter += 1;
    styleToClass.set(normalized, `gate-inline-style-${String(styleCounter).padStart(3, '0')}`);
  }
  const generatedClass = styleToClass.get(normalized);
  let attrs = `${before}${after}`;
  if (/\bclass="[^"]*"/i.test(attrs)) {
    attrs = attrs.replace(/\bclass="([^"]*)"/i, (_classMatch, classes) => `class="${classes} ${generatedClass}"`);
  } else {
    attrs += ` class="${generatedClass}"`;
  }
  return `<${attrs}>`;
});

structureCss = structureCss.replace(new RegExp(`${STYLE_MARKER_START}[\\s\\S]*?${STYLE_MARKER_END}\\n?`, 'g'), '').trimEnd();
const generatedStyles = [...styleToClass.entries()]
  .map(([style, className]) => `.${className} { ${style} }`)
  .join('\n');
structureCss = `${structureCss}\n\n${STYLE_MARKER_START}\n${generatedStyles}\n${STYLE_MARKER_END}\n`;

const actionMap = new Map();
let actionCounter = 0;
index = index.replace(/\sdata-gate-on(click|change|submit|keydown|keyup|input|blur|focus|contextmenu)="([^"]*)"/gi, (_match, eventType, encodedSource) => {
  const source = decodeHtml(encodedSource).trim();
  const key = `${eventType}:${source}`;
  if (!actionMap.has(key)) {
    actionCounter += 1;
    actionMap.set(key, { id: `gate-action-${String(actionCounter).padStart(3, '0')}`, eventType, source });
  }
  const action = actionMap.get(key);
  return ` data-gate-action-${eventType.toLowerCase()}="${action.id}"`;
});

bootstrap = bootstrap.replace(/^\/\/ GATE 3 declarative event boundary[\s\S]*?\n\}\)\(\);\n\n/, '');

const registryEntries = [...actionMap.values()]
  .map(action => `  ${escapeJs(action.id)}: Object.freeze({ eventType: ${escapeJs(action.eventType)}, run(event, element) { return (function () { ${action.source} }).call(element); } })`)
  .join(',\n');

const actionBoundary = `// GATE 3 action registry. Static HTML carries action identifiers only.\n(function installGateActionRegistry() {\n  'use strict';\n\n  const actions = Object.freeze({\n${registryEntries}\n  });\n  const eventTypes = [...new Set(Object.values(actions).map(action => action.eventType))];\n\n  for (const eventType of eventTypes) {\n    document.addEventListener(eventType, event => {\n      const attribute = \`data-gate-action-\${eventType}\`;\n      const element = event.target instanceof Element ? event.target.closest(\`[\${attribute}]\`) : null;\n      if (!element) return;\n      const action = actions[element.getAttribute(attribute)];\n      if (!action) return;\n      if (eventType === 'submit') event.preventDefault();\n      const result = action.run(event, element);\n      if (result === false) {\n        event.preventDefault();\n        event.stopPropagation();\n      }\n    });\n  }\n})();\n\n`;

bootstrap = actionBoundary + bootstrap;

if (/\sstyle="/i.test(index)) throw new Error('Inline style attributes remain in public/index.html.');
if (/\s(?:on\w+|data-gate-on\w+)="/i.test(index)) throw new Error('Executable behavior expressions remain in public/index.html.');
if (!/data-gate-action-/.test(index)) throw new Error('Expected action identifiers were not generated.');
if (!/installGateActionRegistry/.test(bootstrap)) throw new Error('Action registry was not installed.');

await fs.writeFile(INDEX_PATH, index, 'utf8');
await fs.writeFile(BOOTSTRAP_PATH, bootstrap, 'utf8');
await fs.writeFile(STRUCTURE_CSS_PATH, structureCss, 'utf8');

console.log(JSON.stringify({ extractedInlineStyles: styleToClass.size, extractedActions: actionMap.size }));
