export * from './contracts.mjs';
export * from './render-utils.mjs';
export * from './renderers-core.mjs';
export * from './renderers-operational.mjs';

import { componentContracts, validateComponentContracts } from './contracts.mjs';

export const GateComponentWorkshop = Object.freeze({
  version: '2B.1.0',
  contracts: componentContracts,
  validateContracts: validateComponentContracts,
  runtimeStatus: 'inactive'
});
