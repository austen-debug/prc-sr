import {
  ROUTES,
  SHELL_ROLES,
  getDefaultRouteForRole,
  isRouteAllowedForRole
} from './route-registry.mjs';

export const FALLBACK_ROLE = 'airman';

export const SHELL_CONTROL_IDS = Object.freeze([
  'session',
  'theme',
  'density',
  'sound',
  'fullscreen',
  'weekGroupContext'
]);

export const roleRegistry = Object.freeze({
  instructor: Object.freeze({
    id: 'instructor',
    label: 'Instructor',
    description: 'Full operational and administrative access within the authenticated application boundary.'
  }),
  airman: Object.freeze({
    id: 'airman',
    label: 'Airman',
    description: 'Operational access to Status Board and Processing workflows.'
  }),
  squadron: Object.freeze({
    id: 'squadron',
    label: 'Squadron',
    description: 'Read-only access to Squadron Board.'
  })
});

const controls = Object.fromEntries(SHELL_CONTROL_IDS.map(id => [id, Object.freeze({
  id,
  allowedRoles: Object.freeze([...SHELL_ROLES])
})]));

export const permissionRegistry = Object.freeze({
  roles: roleRegistry,
  controls: Object.freeze(controls)
});

export function normalizeShellRole(role) {
  const candidate = String(role || '').trim().toLowerCase();
  return SHELL_ROLES.includes(candidate) ? candidate : FALLBACK_ROLE;
}

export function allowedRoutesForRole(role) {
  const normalizedRole = normalizeShellRole(role);
  return Object.freeze(ROUTES.filter(route => route.allowedRoles.includes(normalizedRole)));
}

export function defaultRouteForRole(role) {
  const normalizedRole = normalizeShellRole(role);
  return getDefaultRouteForRole(normalizedRole);
}

export function canAccessRoute(role, routeId) {
  return isRouteAllowedForRole(routeId, normalizeShellRole(role));
}

export function canUseShellControl(role, controlId) {
  const control = permissionRegistry.controls[String(controlId || '')];
  return Boolean(control && control.allowedRoles.includes(normalizeShellRole(role)));
}

export function validatePermissionRegistry() {
  const errors = [];

  for (const role of SHELL_ROLES) {
    if (!roleRegistry[role]) errors.push(`Missing role contract: ${role}`);
    const allowed = allowedRoutesForRole(role);
    const defaultRoute = defaultRouteForRole(role);
    if (!allowed.length) errors.push(`Role ${role} has no routes.`);
    if (!defaultRoute || !canAccessRoute(role, defaultRoute.id)) errors.push(`Role ${role} has an invalid default route.`);
  }

  for (const controlId of SHELL_CONTROL_IDS) {
    const control = permissionRegistry.controls[controlId];
    if (!control) errors.push(`Missing shell control permission: ${controlId}`);
    for (const role of control?.allowedRoles || []) {
      if (!SHELL_ROLES.includes(role)) errors.push(`Control ${controlId} references unknown role ${role}.`);
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
