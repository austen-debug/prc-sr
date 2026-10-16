-- GATE diagnostic events. Additive, optional until installed; no trainee data or request bodies.
CREATE TABLE IF NOT EXISTS gate_diagnostic_events(
 event_id TEXT PRIMARY KEY,
 source TEXT NOT NULL CHECK(source IN ('server','client')),
 category TEXT NOT NULL CHECK(category IN ('api','runtime','connectivity','ui')),
 severity TEXT NOT NULL CHECK(severity IN ('warning','error')),
 code TEXT NOT NULL,
 route TEXT NOT NULL,
 detail TEXT NOT NULL,
 http_status INTEGER NOT NULL DEFAULT 0 CHECK(http_status BETWEEN 0 AND 599),
 occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_diagnostics_time ON gate_diagnostic_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_diagnostics_category ON gate_diagnostic_events(category,occurred_at DESC);
