export const SHELL_CONTRACT_VERSION = '2C.1.0';

export const SHELL_ROLES = Object.freeze(['instructor', 'airman', 'squadron']);

const routes = [
  {
    id: 'board',
    label: 'Status Board',
    shortLabel: 'Status',
    pageId: 'page-board',
    group: 'operations',
    order: 10,
    allowedRoles: ['instructor', 'airman'],
    defaultForRoles: ['instructor', 'airman'],
    description: 'Live arrivals, active buses, dorm status, and processing progress.'
  },
  {
    id: 'airport',
    label: 'Airport',
    shortLabel: 'Airport',
    pageId: 'page-airport',
    group: 'operations',
    order: 20,
    allowedRoles: ['instructor'],
    defaultForRoles: [],
    description: 'Airport dispatch, arrival confirmation, and bus history.'
  },
  {
    id: 'input',
    label: 'Input',
    shortLabel: 'Input',
    pageId: 'page-input',
    group: 'configuration',
    order: 30,
    allowedRoles: ['instructor'],
    defaultForRoles: [],
    description: 'Week Group initialization, dorm configuration, and receiving windows.'
  },
  {
    id: 'processing',
    label: 'Processing',
    shortLabel: 'Processing',
    pageId: 'page-processing',
    group: 'operations',
    order: 40,
    allowedRoles: ['instructor', 'airman'],
    defaultForRoles: [],
    description: 'Dorm assignment and processing workflow.'
  },
  {
    id: 'archives',
    label: 'Archives',
    shortLabel: 'Archives',
    pageId: 'page-archives',
    group: 'records',
    order: 50,
    allowedRoles: ['instructor'],
    defaultForRoles: [],
    description: 'Historical receiving snapshots, reports, and closeout records.'
  },
  {
    id: 'squadron',
    label: 'Squadron Board',
    shortLabel: 'Squadron',
    pageId: 'page-squadron',
    group: 'leadership',
    order: 60,
    allowedRoles: ['instructor', 'squadron'],
    defaultForRoles: ['squadron'],
    description: 'Read-only squadron and leadership operational summary.'
  }
].map(route => Object.freeze({
  ...route,
  allowedRoles: Object.freeze([...route.allowedRoles]),
  defaultForRoles: Object.freeze([...route.defaultForRoles])
}));

export const ROUTES = Object.freeze(routes);
export const ROUTE_IDS = Object.freeze(ROUTES.map(route => route.id));
export const routeRegistry = Object.freeze(Object.fromEntries(ROUTES.map(route => [route.id, route])));

export function getRoute(routeId) {
  return routeRegistry[String(routeId || '').replace(/^page-/, '')] || null;
}

export function getRoutes() {
  return ROUTES;
}

export function isRouteAllowedForRole(routeId, role) {
  const route = getRoute(routeId);
  return Boolean(route && route.allowedRoles.includes(role));
}

export function getDefaultRouteForRole(role) {
  return ROUTES.find(route => route.defaultForRoles.includes(role)) || null;
}

export function validateRouteRegistry() {
  const errors = [];
  const ids = new Set();
  const pageIds = new Set();
  const orders = new Set();

  for (const route of ROUTES) {
    if (!route.id || !route.label || !route.pageId) errors.push('Every route requires id, label, and pageId.');
    if (ids.has(route.id)) errors.push(`Duplicate route id: ${route.id}`);
    if (pageIds.has(route.pageId)) errors.push(`Duplicate route pageId: ${route.pageId}`);
    if (orders.has(route.order)) errors.push(`Duplicate route order: ${route.order}`);
    ids.add(route.id);
    pageIds.add(route.pageId);
    orders.add(route.order);

    for (const role of [...route.allowedRoles, ...route.defaultForRoles]) {
      if (!SHELL_ROLES.includes(role)) errors.push(`Route ${route.id} references unknown role ${role}.`);
    }
    for (const role of route.defaultForRoles) {
      if (!route.allowedRoles.includes(role)) errors.push(`Route ${route.id} is default for ${role} without granting access.`);
    }
  }

  for (const role of SHELL_ROLES) {
    const defaults = ROUTES.filter(route => route.defaultForRoles.includes(role));
    if (defaults.length !== 1) errors.push(`Role ${role} requires exactly one default route.`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
