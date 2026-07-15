import { getRoute } from './route-registry.mjs';
import { allowedRoutesForRole, canAccessRoute, defaultRouteForRole } from './permission-registry.mjs';

export function selectAllowedRoutes(state) {
  return allowedRoutesForRole(state?.role);
}

export function selectCurrentRoute(state) {
  const route = getRoute(state?.activeRoute);
  if (route && canAccessRoute(state?.role, route.id)) return route;
  return defaultRouteForRole(state?.role);
}

export function selectNavigationModel(state) {
  const current = selectCurrentRoute(state);
  return Object.freeze(selectAllowedRoutes(state).map(route => Object.freeze({
    id: route.id,
    label: route.label,
    shortLabel: route.shortLabel,
    group: route.group,
    active: route.id === current?.id,
    ariaCurrent: route.id === current?.id ? 'page' : null
  })));
}

export function selectPersistenceAnnouncement(state) {
  const status = state?.persistence?.status || 'idle';
  const explicitMessage = String(state?.persistence?.message || '').trim();
  if (explicitMessage) return explicitMessage;
  if (status === 'saving') return 'Saving';
  if (status === 'saved') return 'Saved';
  if (status === 'failed') return 'Save failed. Retry required.';
  if (status === 'conflict') return 'Conflict detected. Refresh or resolve before continuing.';
  if (status === 'stale') return 'Data may be stale.';
  return '';
}

export function selectConnectivityAnnouncement(state) {
  if (state?.connectivity?.online === false) {
    const last = state?.connectivity?.lastSyncedAt;
    return last ? `Offline. Last synchronized ${last}.` : 'Offline. Showing the last confirmed data.';
  }
  return '';
}

export function selectShellContext(state) {
  const currentRoute = selectCurrentRoute(state);
  return Object.freeze({
    role: state?.role || 'airman',
    routeId: currentRoute?.id || '',
    routeLabel: currentRoute?.label || '',
    weekGroup: state?.weekGroup || '',
    theme: state?.theme || 'dark',
    density: state?.density || 'standard',
    navigationMode: state?.navigation?.mode || 'persistent',
    navigationOpen: Boolean(state?.navigation?.open),
    persistenceStatus: state?.persistence?.status || 'idle',
    persistenceAnnouncement: selectPersistenceAnnouncement(state),
    connectivityAnnouncement: selectConnectivityAnnouncement(state)
  });
}
