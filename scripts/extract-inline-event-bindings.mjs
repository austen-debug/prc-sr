import fs from 'node:fs/promises';

const INDEX_PATH = 'public/index.html';
const BOOTSTRAP_PATH = 'public/js/gate-application-bootstrap.js';
const EVENT_ATTRIBUTE = /\s(on(?:click|change|submit|keydown|keyup|input|blur|focus|contextmenu))="([^"]*)"/gi;

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const bridge = `// GATE 3 declarative event boundary. Static HTML carries identifiers only; execution lives here.
(function installGateDeclarativeEventBoundary() {
  'use strict';

  const eventTypes = ['click', 'change', 'submit', 'keydown', 'keyup', 'input', 'blur', 'focus', 'contextmenu'];

  function decode(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }

  function execute(element, event, source) {
    const handler = new Function('event', 'element', \`with (window) { return (function () { \${source} }).call(element); }\`);
    return handler.call(element, event, element);
  }

  for (const eventType of eventTypes) {
    document.addEventListener(eventType, event => {
      const attribute = \`data-gate-on\${eventType}\`;
      const element = event.target instanceof Element ? event.target.closest(\`[\${attribute}]\`) : null;
      if (!element) return;

      if (eventType === 'submit') event.preventDefault();
      const result = execute(element, event, decode(element.getAttribute(attribute)));
      if (result === false) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }
})();

`;

const index = await fs.readFile(INDEX_PATH, 'utf8');
let count = 0;
const migratedIndex = index.replace(EVENT_ATTRIBUTE, (_match, name, source) => {
  count += 1;
  return ` data-gate-${name.toLowerCase()}="${escapeAttribute(source)}"`;
});

const bootstrap = await fs.readFile(BOOTSTRAP_PATH, 'utf8');
const migratedBootstrap = bootstrap.includes('installGateDeclarativeEventBoundary') ? bootstrap : bridge + bootstrap;

await fs.writeFile(INDEX_PATH, migratedIndex, 'utf8');
await fs.writeFile(BOOTSTRAP_PATH, migratedBootstrap, 'utf8');

if (/\son(?:click|change|submit|keydown|keyup|input|blur|focus|contextmenu)="/i.test(migratedIndex)) {
  throw new Error('Executable inline event handlers remain in public/index.html.');
}

console.log(JSON.stringify({ migratedEventAttributes: count }));
