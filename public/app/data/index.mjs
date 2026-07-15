import { GateArchiveRepository } from './repositories/archive-repository.mjs';
import { GateAuditRepository } from './repositories/audit-repository.mjs';
import { GateBusRepository } from './repositories/bus-repository.mjs';
import { GateConfigRepository } from './repositories/config-repository.mjs';
import { GateDormRepository } from './repositories/dorm-repository.mjs';

export * from './canonical-entity.mjs';
export * from './legacy-compatibility.mjs';
export * from './provenance.mjs';
export * from './record-normalizer.mjs';
export * from './repository-result.mjs';
export * from './records-client.mjs';
export * from './repositories/index.mjs';

export function createGateRepositories({ client } = {}) {
  if (!client) throw new TypeError('A records client is required.');
  return Object.freeze({
    buses: new GateBusRepository({ client }),
    dorms: new GateDormRepository({ client }),
    archives: new GateArchiveRepository({ client }),
    config: new GateConfigRepository({ client }),
    audit: new GateAuditRepository({ client })
  });
}
