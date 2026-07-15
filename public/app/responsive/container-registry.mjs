export const CONTAINER_BANDS = Object.freeze([
  Object.freeze({ id: 'compact', minWidth: 0, maxWidth: 319 }),
  Object.freeze({ id: 'standard', minWidth: 320, maxWidth: 639 }),
  Object.freeze({ id: 'expanded', minWidth: 640, maxWidth: Number.POSITIVE_INFINITY })
]);

export const COMPONENT_CONTAINER_CONTRACTS = Object.freeze({
  GateMetricCard: Object.freeze({ compact: 'stacked', standard: 'stacked', expanded: 'inline' }),
  GateDormCard: Object.freeze({ compact: 'summary', standard: 'standard', expanded: 'detailed' }),
  GateBusCard: Object.freeze({ compact: 'summary', standard: 'standard', expanded: 'inline-details' }),
  GateDataTable: Object.freeze({ compact: 'horizontal-scroll', standard: 'horizontal-scroll', expanded: 'full' }),
  GatePageHeader: Object.freeze({ compact: 'stacked', standard: 'wrapped', expanded: 'inline' }),
  GateCommandBar: Object.freeze({ compact: 'stacked', standard: 'wrapped', expanded: 'inline' })
});

export function selectContainerBand(width) {
  const numeric = Number(width);
  const safeWidth = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  return CONTAINER_BANDS.find(band => safeWidth >= band.minWidth && safeWidth <= band.maxWidth) || CONTAINER_BANDS[0];
}

export function selectComponentContainerVariant(componentName, width) {
  const band = selectContainerBand(width);
  const contract = COMPONENT_CONTAINER_CONTRACTS[componentName];
  return Object.freeze({
    componentName,
    band: band.id,
    variant: contract?.[band.id] || band.id
  });
}

export function validateContainerContracts(contracts = COMPONENT_CONTAINER_CONTRACTS) {
  const errors = [];
  const requiredBands = CONTAINER_BANDS.map(band => band.id);

  for (const [componentName, contract] of Object.entries(contracts)) {
    for (const band of requiredBands) {
      if (!contract?.[band]) errors.push(`${componentName} is missing the ${band} container behavior.`);
    }
  }

  for (let index = 1; index < CONTAINER_BANDS.length; index += 1) {
    const previous = CONTAINER_BANDS[index - 1];
    const current = CONTAINER_BANDS[index];
    if (current.minWidth !== previous.maxWidth + 1) errors.push(`Container bands ${previous.id} and ${current.id} are not contiguous.`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
