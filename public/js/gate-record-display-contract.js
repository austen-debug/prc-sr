// GATE Record Display Contract
// Canonical, side-effect-free dorm identity, ordering, and designation normalization.
(function () {
  'use strict';

  function text(value) {
    return String(value ?? '').trim();
  }

  function normalizedIdentityPart(value) {
    return text(value).replace(/\s+/g, ' ').toUpperCase();
  }

  function weekGroup(record) {
    return normalizedIdentityPart(record?.week_group || record?.weekGroup);
  }

  function squadron(record) {
    return normalizedIdentityPart(record?.sdq || record?.squadron);
  }

  function dormName(record) {
    return normalizedIdentityPart(record?.dorm_name || record?.name);
  }

  function dormIdentityKey(record) {
    return `${weekGroup(record)}::${squadron(record)}::${dormName(record)}`;
  }

  function finiteNumber(value) {
    if (value === '' || value === null || typeof value === 'undefined') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function explicitDormOrder(record) {
    const candidates = [
      record?.display_order,
      record?.input_order,
      record?.source_row_index,
      record?.row_index
    ];
    for (const candidate of candidates) {
      const parsed = finiteNumber(candidate);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function createdDormOrder(record) {
    const parsed = Date.parse(record?.created_at || '');
    return Number.isFinite(parsed) ? parsed : null;
  }

  function compareDorms(leftEntry, rightEntry) {
    const left = leftEntry.record;
    const right = rightEntry.record;
    const leftExplicit = explicitDormOrder(left);
    const rightExplicit = explicitDormOrder(right);

    if (leftExplicit !== null && rightExplicit !== null && leftExplicit !== rightExplicit) return leftExplicit - rightExplicit;
    if (leftExplicit !== null && rightExplicit === null) return -1;
    if (leftExplicit === null && rightExplicit !== null) return 1;

    const leftCreated = createdDormOrder(left);
    const rightCreated = createdDormOrder(right);
    if (leftCreated !== null && rightCreated !== null && leftCreated !== rightCreated) return leftCreated - rightCreated;
    if (leftCreated !== null && rightCreated === null) return -1;
    if (leftCreated === null && rightCreated !== null) return 1;

    const identityDifference = dormIdentityKey(left).localeCompare(dormIdentityKey(right), undefined, { numeric: true, sensitivity: 'base' });
    if (identityDifference !== 0) return identityDifference;

    return leftEntry.sourceIndex - rightEntry.sourceIndex;
  }

  function sortDorms(records = []) {
    return (Array.isArray(records) ? records : [])
      .map((record, sourceIndex) => ({ record, sourceIndex }))
      .sort(compareDorms)
      .map(entry => entry.record);
  }

  function truthyFlag(value) {
    return value === true || value === 1 || value === '1' || text(value).toLowerCase() === 'true';
  }

  function normalizeDormFlags(record = {}) {
    const spaceForce = truthyFlag(record.space_force) || truthyFlag(record.is_space_force);
    const band = !spaceForce && truthyFlag(record.band);
    return Object.freeze({ band, spaceForce });
  }

  window.GateRecordDisplay = Object.freeze({
    dormIdentityKey,
    explicitDormOrder,
    createdDormOrder,
    sortDorms,
    truthyFlag,
    normalizeDormFlags
  });
})();