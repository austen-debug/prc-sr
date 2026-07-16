export const GATE_INVALIDATION_CHANNEL = 'gate-build-2-record-invalidation';
export const INVALIDATION_KIND = 'records.invalidated';

const ALLOWED_KEYS = Object.freeze([
  'kind',
  'contractVersion',
  'entityType',
  'entityId',
  'weekGroup',
  'operationId',
  'occurredAt',
  'originId'
]);

const CONSTRUCTION_KEYS = Object.freeze([
  'entityType',
  'entityId',
  'weekGroup',
  'operationId',
  'occurredAt',
  'originId'
]);

function text(value) {
  return String(value ?? '').trim();
}

export function createInvalidationNotice(input = {}) {
  const extraKeys = Object.keys(input).filter(key => !CONSTRUCTION_KEYS.includes(key));
  if (extraKeys.length) {
    throw new TypeError(`Invalidation notice contains prohibited fields: ${extraKeys.join(', ')}.`);
  }
  const notice = Object.freeze({
    kind: INVALIDATION_KIND,
    contractVersion: 'E.1.0',
    entityType: text(input.entityType).toLowerCase(),
    entityId: text(input.entityId),
    weekGroup: text(input.weekGroup).toUpperCase(),
    operationId: text(input.operationId),
    occurredAt: text(input.occurredAt),
    originId: text(input.originId)
  });
  const validation = validateInvalidationNotice(notice);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  return notice;
}

export function validateInvalidationNotice(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['Invalidation notice must be an object.']) });
  }
  const extraKeys = Object.keys(value).filter(key => !ALLOWED_KEYS.includes(key));
  if (extraKeys.length) errors.push(`Invalidation notice contains prohibited fields: ${extraKeys.join(', ')}.`);
  if (value.kind !== INVALIDATION_KIND) errors.push('Invalid invalidation kind.');
  if (value.contractVersion !== 'E.1.0') errors.push('Invalid invalidation contract version.');
  if (!text(value.entityType)) errors.push('Invalidation entity type is required.');
  if (!text(value.occurredAt) || !Number.isFinite(Date.parse(value.occurredAt))) errors.push('Invalidation occurredAt must be a valid timestamp.');
  if (!text(value.originId)) errors.push('Invalidation originId is required.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function createBroadcastInvalidationChannel({
  BroadcastChannelImpl = globalThis.BroadcastChannel,
  channelName = GATE_INVALIDATION_CHANNEL,
  originId = ''
} = {}) {
  const localOrigin = text(originId);
  if (!localOrigin) throw new TypeError('A synchronization originId is required.');
  const listeners = new Set();
  let channel = null;

  if (typeof BroadcastChannelImpl === 'function') {
    channel = new BroadcastChannelImpl(channelName);
    channel.onmessage = event => {
      const notice = event?.data;
      const validation = validateInvalidationNotice(notice);
      if (!validation.valid || notice.originId === localOrigin) return;
      for (const listener of listeners) listener(notice);
    };
  }

  return Object.freeze({
    available: Boolean(channel),
    originId: localOrigin,

    publish(input = {}) {
      if (!channel) return false;
      const notice = createInvalidationNotice({ ...input, originId: localOrigin });
      channel.postMessage(notice);
      return true;
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('An invalidation listener is required.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    close() {
      listeners.clear();
      channel?.close?.();
      channel = null;
    }
  });
}
