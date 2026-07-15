export * from './posture-registry.mjs';
export * from './composition-selector.mjs';
export * from './container-registry.mjs';

import { POSTURES, validatePostureRegistry } from './posture-registry.mjs';
import { validateContainerContracts } from './container-registry.mjs';

export const GateResponsiveComposition = Object.freeze({
  version: '2D.1.0',
  postures: POSTURES,
  validatePostures: validatePostureRegistry,
  validateContainers: validateContainerContracts,
  runtimeStatus: 'inactive'
});
