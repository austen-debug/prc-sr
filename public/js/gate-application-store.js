// Canonical GATE 3 application state and selector boundary.
(function () {
  'use strict';
  let records = [];
  let session = Object.freeze({ role: 'airman', username: '' });
  const listeners = new Set();
  const snapshot = () => Object.freeze({ records: records.slice(), session });
  const emit = source => listeners.forEach(listener => listener(snapshot(), source));
  window.GateApplicationStore = Object.freeze({
    records: () => records,
    replaceRecords(next, source = 'replace-records') { records = Array.isArray(next) ? next : []; emit(source); },
    upsert(record, source = 'upsert-record') {
      if (!record) return;
      const id = record.__backendId;
      const index = id ? records.findIndex(item => item?.__backendId === id) : -1;
      if (index >= 0) records[index] = { ...records[index], ...record }; else records.push(record);
      emit(source);
    },
    remove(recordOrId, source = 'remove-record') {
      const id = typeof recordOrId === 'string' ? recordOrId : recordOrId?.__backendId;
      if (!id) return;
      records = records.filter(item => item?.__backendId !== id); emit(source);
    },
    selectType(type) { return records.filter(record => record?.type === type); },
    config(key) { return records.find(record => record?.type === 'config' && record.key === key)?.value || ''; },
    activeWeekGroup() { return this.config('week_group'); },
    setSession(next) { session = Object.freeze({ role: next?.role || 'airman', username: next?.username || '' }); emit('session'); },
    session: () => session,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
})();
