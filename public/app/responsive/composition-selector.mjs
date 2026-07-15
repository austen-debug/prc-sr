import { getPosture } from './posture-registry.mjs';

const POINTERS = new Set(['fine', 'coarse', 'none']);

function finiteDimension(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function inset(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function normalizeCompositionInput(input = {}) {
  const width = finiteDimension(input.width, 390);
  const height = finiteDimension(input.height, 844);
  const pointer = POINTERS.has(input.pointer) ? input.pointer : 'coarse';
  const safeArea = input.safeArea || {};

  return Object.freeze({
    width,
    height,
    orientation: width >= height ? 'landscape' : 'portrait',
    pointer,
    hover: Boolean(input.hover) && pointer === 'fine',
    keyboard: Boolean(input.keyboard),
    reducedMotion: Boolean(input.reducedMotion),
    safeArea: Object.freeze({
      top: inset(safeArea.top),
      right: inset(safeArea.right),
      bottom: inset(safeArea.bottom),
      left: inset(safeArea.left)
    })
  });
}

export function resolvePostureId(input = {}) {
  const context = normalizeCompositionInput(input);

  if (context.orientation === 'landscape') {
    if (context.width >= 1180 && context.height >= 700) return 'desktop-landscape';
    if (context.width >= 768) return 'tablet-landscape';
    return 'phone-landscape';
  }

  if (context.width >= 900 && context.height >= 1180) return 'desktop-vertical';
  if (context.width >= 600) return 'tablet-portrait';
  return 'phone-portrait';
}

function resolveDensity(posture, context) {
  if (context.pointer === 'coarse' || context.pointer === 'none') return 'touch';
  if (posture.shell.defaultDensity === 'touch' && !context.keyboard) return 'touch';
  return posture.shell.defaultDensity;
}

function resolveMinimumTarget(density, context) {
  if (density === 'touch' || context.pointer !== 'fine') return 44;
  if (density === 'standard') return 40;
  return 32;
}

export function selectResponsiveComposition(input = {}) {
  const context = normalizeCompositionInput(input);
  const posture = getPosture(resolvePostureId(context));
  const density = resolveDensity(posture, context);

  return Object.freeze({
    version: '2D.1.0',
    postureId: posture.id,
    postureLabel: posture.label,
    orientation: context.orientation,
    width: context.width,
    height: context.height,
    navigationMode: posture.shell.navigationMode,
    headerMode: posture.shell.headerMode,
    systemControls: posture.shell.systemControls,
    density,
    minimumTarget: resolveMinimumTarget(density, context),
    columnRange: posture.content.columnRange,
    commandBar: posture.content.commandBar,
    detailPresentation: posture.content.detailPresentation,
    overflow: posture.content.overflow,
    hoverEnhancements: context.hover,
    keyboardShortcuts: context.keyboard,
    reducedMotion: context.reducedMotion,
    safeArea: context.safeArea,
    capabilities: Object.freeze({
      pointer: context.pointer,
      hover: context.hover,
      keyboard: context.keyboard
    })
  });
}

export function validateResponsiveComposition(composition) {
  const errors = [];
  if (!composition?.postureId) errors.push('Composition requires a posture ID.');
  if (!['landscape', 'portrait'].includes(composition?.orientation)) errors.push('Composition orientation is invalid.');
  if (!['persistent', 'compact', 'sheet'].includes(composition?.navigationMode)) errors.push('Composition navigation mode is invalid.');
  if (!['command', 'standard', 'touch'].includes(composition?.density)) errors.push('Composition density is invalid.');
  if ((composition?.minimumTarget || 0) < 32) errors.push('Composition target size is below the governed minimum.');
  if (composition?.capabilities?.pointer !== 'fine' && (composition?.minimumTarget || 0) < 44) errors.push('Coarse or absent pointer requires a 44px minimum target.');
  if (!Array.isArray(composition?.columnRange) || composition.columnRange.length !== 2) errors.push('Composition requires a column range.');
  for (const value of Object.values(composition?.safeArea || {})) {
    if (!Number.isFinite(value) || value < 0) errors.push('Safe-area values must be non-negative finite numbers.');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
