export const RESPONSIVE_CONTRACT_VERSION = '2D.1.0';

export const POSTURE_IDS = Object.freeze([
  'desktop-landscape',
  'desktop-vertical',
  'tablet-landscape',
  'tablet-portrait',
  'phone-landscape',
  'phone-portrait'
]);

const posture = (definition) => Object.freeze({
  ...definition,
  shell: Object.freeze(definition.shell),
  content: Object.freeze(definition.content),
  requirements: Object.freeze(definition.requirements)
});

export const POSTURES = Object.freeze([
  posture({
    id: 'desktop-landscape',
    label: 'Desktop landscape',
    orientation: 'landscape',
    priority: 60,
    shell: {
      navigationMode: 'persistent',
      headerMode: 'full',
      systemControls: 'inline',
      defaultDensity: 'command'
    },
    content: {
      columnRange: Object.freeze([2, 4]),
      commandBar: 'inline',
      detailPresentation: 'side-panel',
      overflow: 'regional'
    },
    requirements: {
      minWidth: 1180,
      minHeight: 700,
      description: 'Wide landscape workspace with sufficient vertical operating area.'
    }
  }),
  posture({
    id: 'desktop-vertical',
    label: 'Desktop vertical',
    orientation: 'portrait',
    priority: 50,
    shell: {
      navigationMode: 'compact',
      headerMode: 'condensed',
      systemControls: 'menu',
      defaultDensity: 'standard'
    },
    content: {
      columnRange: Object.freeze([1, 2]),
      commandBar: 'wrapped',
      detailPresentation: 'inline',
      overflow: 'regional'
    },
    requirements: {
      minWidth: 900,
      minHeight: 1180,
      description: 'Tall fixed display or portrait desktop workspace.'
    }
  }),
  posture({
    id: 'tablet-landscape',
    label: 'Tablet landscape',
    orientation: 'landscape',
    priority: 40,
    shell: {
      navigationMode: 'compact',
      headerMode: 'condensed',
      systemControls: 'menu',
      defaultDensity: 'standard'
    },
    content: {
      columnRange: Object.freeze([1, 3]),
      commandBar: 'wrapped',
      detailPresentation: 'sheet-or-inline',
      overflow: 'regional'
    },
    requirements: {
      minWidth: 768,
      minHeight: 0,
      description: 'Medium-width landscape workspace below the wide desktop threshold.'
    }
  }),
  posture({
    id: 'tablet-portrait',
    label: 'Tablet portrait',
    orientation: 'portrait',
    priority: 30,
    shell: {
      navigationMode: 'sheet',
      headerMode: 'minimal',
      systemControls: 'sheet',
      defaultDensity: 'touch'
    },
    content: {
      columnRange: Object.freeze([1, 2]),
      commandBar: 'stacked',
      detailPresentation: 'sheet',
      overflow: 'page'
    },
    requirements: {
      minWidth: 600,
      minHeight: 0,
      description: 'Medium-width portrait workspace below the vertical desktop threshold.'
    }
  }),
  posture({
    id: 'phone-landscape',
    label: 'Phone landscape',
    orientation: 'landscape',
    priority: 20,
    shell: {
      navigationMode: 'sheet',
      headerMode: 'minimal',
      systemControls: 'sheet',
      defaultDensity: 'touch'
    },
    content: {
      columnRange: Object.freeze([1, 2]),
      commandBar: 'stacked',
      detailPresentation: 'sheet',
      overflow: 'page'
    },
    requirements: {
      minWidth: 0,
      minHeight: 0,
      description: 'Narrow landscape workspace requiring height conservation and touch-safe controls.'
    }
  }),
  posture({
    id: 'phone-portrait',
    label: 'Phone portrait',
    orientation: 'portrait',
    priority: 10,
    shell: {
      navigationMode: 'sheet',
      headerMode: 'minimal',
      systemControls: 'sheet',
      defaultDensity: 'touch'
    },
    content: {
      columnRange: Object.freeze([1, 1]),
      commandBar: 'stacked',
      detailPresentation: 'sheet',
      overflow: 'page'
    },
    requirements: {
      minWidth: 0,
      minHeight: 0,
      description: 'Narrow portrait workspace with one primary content column.'
    }
  })
]);

export const POSTURE_BY_ID = Object.freeze(Object.fromEntries(POSTURES.map(item => [item.id, item])));

export function getPosture(id) {
  return POSTURE_BY_ID[id] || POSTURE_BY_ID['phone-portrait'];
}

export function validatePostureRegistry(postures = POSTURES) {
  const errors = [];
  const ids = postures.map(item => item.id);
  const navigationModes = new Set(['persistent', 'compact', 'sheet']);
  const densities = new Set(['command', 'standard', 'touch']);
  const orientations = new Set(['landscape', 'portrait']);

  if (postures.length !== POSTURE_IDS.length) errors.push('Responsive registry must define exactly six postures.');
  if (new Set(ids).size !== ids.length) errors.push('Responsive posture IDs must be unique.');
  for (const required of POSTURE_IDS) {
    if (!ids.includes(required)) errors.push(`Missing posture: ${required}`);
  }

  for (const item of postures) {
    if (!orientations.has(item.orientation)) errors.push(`${item.id} has an invalid orientation.`);
    if (!navigationModes.has(item.shell?.navigationMode)) errors.push(`${item.id} has an invalid navigation mode.`);
    if (!densities.has(item.shell?.defaultDensity)) errors.push(`${item.id} has an invalid default density.`);
    if (!Array.isArray(item.content?.columnRange) || item.content.columnRange.length !== 2) errors.push(`${item.id} requires a two-value column range.`);
    if ((item.content?.columnRange?.[0] || 0) < 1) errors.push(`${item.id} must support at least one content column.`);
    if ((item.content?.columnRange?.[1] || 0) < (item.content?.columnRange?.[0] || 0)) errors.push(`${item.id} has an invalid column range.`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
