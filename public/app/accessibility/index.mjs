export * from './contract-registry.mjs';
export * from './focus-contract.mjs';
export * from './overlay-controller.mjs';
export * from './announcer.mjs';

import { validateAccessibilityContracts } from './contract-registry.mjs';

export const GateAccessibilityFoundation = Object.freeze({
  version: '2E.1.0',
  standard: 'WCAG 2.2 AA',
  validateContracts: validateAccessibilityContracts,
  runtimeStatus: 'staged'
});
