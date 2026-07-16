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
  const connectivity = state?.connectivity || {};
  const explicitMessage = String(connectivity.message || '').trim();
  if (explicitMessage) return explicitMessage;
  const last = connectivity.lastSyncedAt;
  if (connectivity.status === 'syncing') return 'Synchronizing authoritative records.';
  if (connectivity.status === 'offline' || connectivity.online === false) {
    return last ? `Offline. Last synchronized ${last}. Critical writes are disabled.` : 'Offline. No confirmed snapshot is available. Critical writes are disabled.';
  }
  if (connectivity.status === 'stale') {
    return last ? `Data is stale. Last synchronized ${last}. Critical writes are disabled until refresh.` : 'Data is stale. Critical writes are disabled until refresh.';
  }
  if (connectivity.status === 'failed') {
    return last ? `Synchronization failed. Showing data confirmed ${last}. Critical writes are disabled.` : 'Synchronization failed. Critical writes are disabled.';
  }
  return '';
}

export function selectDegradedOperationModel(state) {
  const connectivity = state?.connectivity || {};
  return Object.freeze({
    status: connectivity.status || 'unknown',
    online: connectivity.online !== false,
    authoritative: connectivity.authoritative === true,
    stale: connectivity.stale === true,
    readOnly: connectivity.readOnly !== false,
    lastSyncedAt: connectivity.lastSyncedAt || null,
    announcement: selectConnectivityAnnouncement(state)
  });
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
    connectivity: selectDegradedOperationModel(state),
    connectivityAnnouncement: selectConnectivityAnnouncement(state)
  });
}
