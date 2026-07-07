// GATE branding controller
// Normalizes user-visible legacy terminology without renaming routes, files, cookies, API keys, or data fields.
(function () {
  'use strict';

  const APP_TITLE = 'GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center';
  const APP_DESCRIPTION = 'Gateway Arrival Tracking Environment for Pfingston Reception Center receiving operations.';

  const TEXT_REPLACEMENTS = [
    [/\bPRC\s*DASH\b/gi, 'GATE'],
    [/\bPRC\s*GATE\b/gi, 'GATE'],
    [/\bPRC[-\s]*SR\b/gi, 'GATE'],
    [/\bPfingston Reception Status Board\b/gi, 'GATE — Gateway Arrival Tracking Environment'],
    [/\bGateway Arrival Tracking Environment\s*\|\s*Pfingston Reception Center\b/gi, 'Gateway Arrival Tracking Environment | Pfingston Reception Center'],
    [/\bDashboard\b/g, 'Board'],
    [/\bdashboard\b/g, 'board']
  ];

  const ATTRIBUTE_NAMES = ['title', 'aria-label', 'aria-description', 'placeholder', 'alt'];
  const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT']);
  let hooksRegistered = false;
  let observerStarted = false;
  let normalizationQueued = false;

  function normalizeText(value) {
    let output = String(value ?? '');
    for (const [pattern, replacement] of TEXT_REPLACEMENTS) output = output.replace(pattern, replacement);
    return output;
  }

  function shouldSkipTextNode(node) {
    const parent = node?.parentElement;
    if (!parent) return true;
    if (BLOCKED_TAGS.has(parent.tagName)) return true;
    if (parent.closest('[data-gate-preserve-branding="true"]')) return true;
    return false;
  }

  function normalizeTextNodes(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        return normalizeText(node.nodeValue) !== node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(textNode => {
      textNode.nodeValue = normalizeText(textNode.nodeValue);
    });
  }

  function normalizeAttributes(root) {
    const scope = root && root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (!scope) return;

    const elements = [scope, ...Array.from(scope.querySelectorAll('*'))];
    elements.forEach(element => {
      if (BLOCKED_TAGS.has(element.tagName)) return;
      if (element.closest('[data-gate-preserve-branding="true"]')) return;

      ATTRIBUTE_NAMES.forEach(attributeName => {
        if (!element.hasAttribute(attributeName)) return;
        const current = element.getAttribute(attributeName);
        const next = normalizeText(current);
        if (next !== current) element.setAttribute(attributeName, next);
      });
    });
  }

  function ensureDocumentBranding() {
    document.title = APP_TITLE;
    document.documentElement.dataset.app = 'gate';
    document.documentElement.dataset.appName = 'Gateway Arrival Tracking Environment';

    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = APP_DESCRIPTION;
  }

  function normalizeBranding(root) {
    ensureDocumentBranding();
    normalizeTextNodes(root);
    normalizeAttributes(root);
  }

  function scheduleNormalize(root) {
    if (normalizationQueued) return;
    normalizationQueued = true;
    window.requestAnimationFrame(() => {
      normalizationQueued = false;
      normalizeBranding(root);
    });
  }

  function startObserver() {
    if (observerStarted || typeof MutationObserver === 'undefined' || !document.body) return;
    observerStarted = true;

    const observer = new MutationObserver(mutations => {
      let target = null;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          target = mutation.target?.nodeType === Node.ELEMENT_NODE ? mutation.target : document.body;
          break;
        }
        if (mutation.type === 'attributes') {
          target = mutation.target?.nodeType === Node.ELEMENT_NODE ? mutation.target : document.body;
          break;
        }
        if (mutation.type === 'characterData') {
          target = mutation.target?.parentElement || document.body;
          break;
        }
      }
      if (target) scheduleNormalize(target);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES
    });
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', () => scheduleNormalize(document.body));
    window.registerGateHook('afterPageChange', () => scheduleNormalize(document.body));
    window.registerGateHook('afterDataChanged', () => scheduleNormalize(document.body));
    window.registerGateHook('afterModalOpen', () => scheduleNormalize(document.body));
    window.registerGateHook('afterCloseout', () => scheduleNormalize(document.body));
    hooksRegistered = true;
  }

  function startBrandingController() {
    normalizeBranding(document.body);
    startObserver();
    registerHooksOnce();

    window.GateBrandingController = Object.freeze({
      isCanonicalBrandingOwner: true,
      appTitle: APP_TITLE,
      appDescription: APP_DESCRIPTION,
      normalize: normalizeBranding,
      normalizeText
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBrandingController, { once: true });
  } else {
    startBrandingController();
  }

  window.addEventListener('load', startBrandingController, { once: true });
})();
