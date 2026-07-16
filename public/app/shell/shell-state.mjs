import {
  allowedRoutesForRole,
  canAccessRoute,
  defaultRouteForRole,
  normalizeShellRole
} from './permission-registry.mjs';

export const NAVIGATION_MODES = Object.freeze(['persistent', 'compact', 'sheet']);
export const SHELL_THEMES = Object.freeze(['dark', 'light']);
export const SHELL_DENSITIES = Object.freeze(['command', 'standard', 'touch']);
export const PERSISTENCE_STATES = Object.freeze(['idle', 'saving', 'saved', 'failed', 'conflict', 'stale']);
export const CONNECTIVITY_STATES = Object.freeze(['unknown', 'syncing', 'current', 'offline', 'stale', 'failed']);

function text(value) {
  return String(value ?? '').trim();
}

function normalizeChoice(value, allowed, fallback) {
  const candidate = text(value).toLowerCase();
  return allowed.includes(candidate) ? candidate : fallback;
}

function freezeState(state) {
  return Object.freeze({
    ...state,
    navigation: Object.freeze({ ...state.navigation }),
    persistence: Object.freeze({ ...state.persistence }),
    connectivity: Object.freeze({ ...state.connectivity }),
    notice: state.notice ? Object.freeze({ ...state.notice }) : null
  });
}

function allowedRouteId(role, requested) {
  const clean = text(requested).replace(/^page-/, '');
  if (clean && canAccessRoute(role, clean)) return clean;
  return defaultRouteForRole(role)?.id || allowedRoutesForRole(role)[0]?.id || 'board';
}

function accessDeniedNotice(routeId, role) {
  return Object.freeze({
    kind: 'access-denied',
    routeId: text(routeId).replace(/^page-/, ''),
    message: role === 'squadron'
      ? 'Squadron access is limited to Squadron Board.'
      : 'Instructor access is required for that route.'
  });
}

export function createShellState(input = {}) {
  const role = normalizeShellRole(input.role);
  const navigationMode = normalizeChoice(input.navigationMode, NAVIGATION_MODES, 'persistent');
  const activeRoute = allowedRouteId(role, input.activeRoute);
  const online = input.online !== false;
  const connectivityStatus = normalizeChoice(
    input.connectivityStatus,
    CONNECTIVITY_STATES,
    online ? (input.lastSyncedAt ? 'current' : 'unknown') : 'offline'
  );

  return freezeState({
    contractVersion: '2E.1.0',
    role,
    activeRoute,
    weekGroup: text(input.weekGroup).toUpperCase(),
    theme: normalizeChoice(input.theme, SHELL_THEMES, 'dark'),
    density: normalizeChoice(input.density, SHELL_DENSITIES, 'standard'),
    navigation: {
      mode: navigationMode,
      open: navigationMode !== 'persistent' && Boolean(input.navigationOpen)
    },
    persistence: {
      status: normalizeChoice(input.persistenceStatus, PERSISTENCE_STATES, 'idle'),
      message: text(input.persistenceMessage),
      updatedAt: text(input.persistenceUpdatedAt) || null
    },
    connectivity: {
      online,
      status: connectivityStatus,
      authoritative: input.authoritative === true || connectivityStatus === 'current',
      stale: Boolean(input.stale) || ['offline', 'stale', 'failed'].includes(connectivityStatus),
      readOnly: input.readOnly === true || connectivityStatus !== 'current',
      lastSyncedAt: text(input.lastSyncedAt) || null,
      lastAttemptAt: text(input.lastAttemptAt) || null,
      message: text(input.connectivityMessage)
    },
    notice: null
  });
}

export function reduceShellState(state, event = {}) {
  const current = state || createShellState();
  const type = text(event.type);

  if (type === 'route.requested') {
    const requested = text(event.routeId).replace(/^page-/, '');
    if (canAccessRoute(current.role, requested)) {
      return freezeState({ ...current, activeRoute: requested, navigation: { ...current.navigation, open: false }, notice: null });
    }
    return freezeState({ ...current, navigation: { ...current.navigation, open: false }, notice: accessDeniedNotice(requested, current.role) });
  }

  if (type === 'role.changed') {
    const role = normalizeShellRole(event.role);
    const activeRoute = canAccessRoute(role, current.activeRoute)
      ? current.activeRoute
      : allowedRouteId(role, event.preferredRoute);
    return freezeState({ ...current, role, activeRoute, navigation: { ...current.navigation, open: false }, notice: null });
  }

  if (type === 'weekGroup.changed') return freezeState({ ...current, weekGroup: text(event.weekGroup).toUpperCase(), notice: null });

  if (type === 'navigation.modeChanged') {
    const mode = normalizeChoice(event.mode, NAVIGATION_MODES, current.navigation.mode);
    return freezeState({ ...current, navigation: { mode, open: mode === 'persistent' ? false : current.navigation.open } });
  }

  if (type === 'navigation.opened') return freezeState({ ...current, navigation: { ...current.navigation, open: current.navigation.mode !== 'persistent' } });
  if (type === 'navigation.closed') return freezeState({ ...current, navigation: { ...current.navigation, open: false } });

  if (type === 'navigation.toggled') {
    const open = current.navigation.mode === 'persistent' ? false : !current.navigation.open;
    return freezeState({ ...current, navigation: { ...current.navigation, open } });
  }

  if (type === 'theme.changed') return freezeState({ ...current, theme: normalizeChoice(event.theme, SHELL_THEMES, current.theme) });
  if (type === 'density.changed') return freezeState({ ...current, density: normalizeChoice(event.density, SHELL_DENSITIES, current.density) });

  if (type === 'persistence.changed') {
    return freezeState({
      ...current,
      persistence: {
        status: normalizeChoice(event.status, PERSISTENCE_STATES, current.persistence.status),
        message: text(event.message),
        updatedAt: text(event.updatedAt) || current.persistence.updatedAt
      }
    });
  }

  if (type === 'connectivity.changed') {
    const online = Boolean(event.online);
    return freezeState({
      ...current,
      connectivity: {
        ...current.connectivity,
        online,
        status: online ? 'stale' : 'offline',
        authoritative: false,
        stale: true,
        readOnly: true,
        lastSyncedAt: text(event.lastSyncedAt) || current.connectivity.lastSyncedAt,
        message: text(event.message) || (online ? 'Connection restored. Refresh required.' : 'Offline. Showing last confirmed data.')
      }
    });
  }

  if (type === 'sync.started') {
    return freezeState({
      ...current,
      connectivity: {
        ...current.connectivity,
        online: true,
        status: 'syncing',
        authoritative: false,
        stale: Boolean(current.connectivity.lastSyncedAt),
        readOnly: true,
        lastAttemptAt: text(event.startedAt) || current.connectivity.lastAttemptAt,
        message: text(event.message) || 'Synchronizing authoritative records.'
      }
    });
  }

  if (type === 'sync.invalidated') {
    return freezeState({
      ...current,
      connectivity: {
        ...current.connectivity,
        status: current.connectivity.online ? 'stale' : 'offline',
        authoritative: false,
        stale: true,
        readOnly: true,
        message: text(event.message) || 'Operational records changed in another session. Refresh required.'
      }
    });
  }

  if (type === 'sync.failed') {
    return freezeState({
      ...current,
      connectivity: {
        ...current.connectivity,
        status: current.connectivity.online ? 'failed' : 'offline',
        authoritative: false,
        stale: true,
        readOnly: true,
        lastAttemptAt: text(event.failedAt) || current.connectivity.lastAttemptAt,
        message: text(event.message) || 'Synchronization failed. Showing last confirmed data.'
      }
    });
  }

  if (type === 'sync.completed') {
    const completedAt = text(event.completedAt) || current.connectivity.lastSyncedAt;
    return freezeState({
      ...current,
      connectivity: {
        online: true,
        status: 'current',
        authoritative: true,
        stale: false,
        readOnly: false,
        lastSyncedAt: completedAt,
        lastAttemptAt: completedAt,
        message: text(event.connectivityMessage) || 'Authoritative records synchronized.'
      },
      persistence: {
        status: 'saved',
        message: text(event.message || 'Saved'),
        updatedAt: completedAt || current.persistence.updatedAt
      }
    });
  }

  if (type === 'notice.cleared') return freezeState({ ...current, notice: null });
  return current;
}

export function validateShellState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return Object.freeze({ valid: false, errors: Object.freeze(['Shell state is required.']) });
  if (!canAccessRoute(state.role, state.activeRoute)) errors.push('Active route is not permitted for the current role.');
  if (!NAVIGATION_MODES.includes(state.navigation?.mode)) errors.push('Invalid navigation mode.');
  if (state.navigation?.mode === 'persistent' && state.navigation?.open) errors.push('Persistent navigation cannot be open as an overlay.');
  if (!SHELL_THEMES.includes(state.theme)) errors.push('Invalid theme.');
  if (!SHELL_DENSITIES.includes(state.density)) errors.push('Invalid density.');
  if (!PERSISTENCE_STATES.includes(state.persistence?.status)) errors.push('Invalid persistence state.');
  if (!CONNECTIVITY_STATES.includes(state.connectivity?.status)) errors.push('Invalid connectivity state.');
  if (state.connectivity?.authoritative && state.connectivity?.stale) errors.push('Stale shell data cannot be authoritative.');
  if (state.connectivity?.authoritative && state.connectivity?.online === false) errors.push('Offline shell data cannot be authoritative.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
