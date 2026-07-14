// GATE tablet shell classifier
// Extends the canonical app-shell media decision to tablet console viewports before the shell controller initializes.
(function () {
  'use strict';

  const LEGACY_SHELL_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px) and (max-height: 560px)';
  const TABLET_CONSOLE_QUERY = '(any-pointer: coarse) and (min-width: 768px) and (max-width: 1366px) and (min-height: 561px)';
  const RESPONSIVE_SHELL_QUERY = `${LEGACY_SHELL_QUERY}, ${TABLET_CONSOLE_QUERY}`;

  if (window.__gateTabletShellClassifierInstalled || typeof window.matchMedia !== 'function') return;

  const nativeMatchMedia = window.matchMedia.bind(window);
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const legacyNormalized = normalize(LEGACY_SHELL_QUERY);

  window.matchMedia = function gateResponsiveMatchMedia(query) {
    if (normalize(query) === legacyNormalized) return nativeMatchMedia(RESPONSIVE_SHELL_QUERY);
    return nativeMatchMedia(query);
  };

  window.__gateTabletShellClassifierInstalled = true;
  window.GateTabletShellClassifier = Object.freeze({
    legacyQuery: LEGACY_SHELL_QUERY,
    tabletQuery: TABLET_CONSOLE_QUERY,
    responsiveQuery: RESPONSIVE_SHELL_QUERY,
    matches: () => nativeMatchMedia(TABLET_CONSOLE_QUERY).matches
  });
})();