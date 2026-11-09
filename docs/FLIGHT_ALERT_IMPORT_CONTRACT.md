# GATE Flight Alert acceptance contract

Updated 9 November 2026. This is the operational contract for Flight Alert PDF extraction, pasted text review, Input draft preparation, and Week Group initialization.

## Accepted table headings

| Field | Authoritative headings |
| --- | --- |
| Squadron | `SQUADRON`, `SQD`, `SQDRN` |
| Section | `SECTION`, `SECT`, `SEC` |
| Internal section / flight sequence | `INTERNAL SECTION`, `INTER`, `INTER/SECT` |
| Dorm | `DORMITORY`, `DORM` |
| Sex | `SEX`, `GENDER` |
| Expected load | `LOAD`, `FLT LOAD`, `FLIGHT LOAD` |

For backward compatibility, the parser also retains `SDQ`, `SQDN`, `INTER/SEC`, and `EXPECTED`. Multiword PDF headings may be one text item or separately positioned adjacent text items.

Sex values use an explicit `M`/`MALE` or `F`/`FEMALE` indicator. Missing values require correction and are not presumed male.

## Supported squadrons

`320`, `321`, `322`, `323`, `324`, `326`, `327`, `328`, `331`, `535`, optionally suffixed `TRS`.

- 321 TRS may have Band dorms after explicit operator review.
- 535 TRS is always Space Force and may not also be Band.
- Other squadrons may retain an explicitly set Space Force classification where the operating roster calls for it.

## Dorm identifiers

Exactly three characters: `LNN` (e.g. `A03`) or `NLN` (e.g. `3D2`), case-insensitive; normalized to uppercase. No synthetic dorm identity is created for unreadable source cells.

## Capacity and high-load confirmation

| Category | No-confirmation range | Explicit confirmation required | Maximum |
| --- | --- | --- | --- |
| Ordinary dorm | 1–70 | 71–100 | 100 |
| Space Force dorm | 1–70 | 71–300 | 300 |

The ordinary maximum of 100 is retained from the prior GATE contract because the new instruction specifies a 70-person confirmation threshold but does not set a new post-confirmation ordinary ceiling. The maximum can be adjusted separately if operations authorize a different value.

A confirmation is an explicit `load_confirmed` boolean on the source Input row. PDF import requires review acknowledgement for any extracted load above 70. The Input grid exposes a per-row checkbox to confirm or reconfirm elevated loads. The field survives D1 draft save/reload. The server requires the flag before either legacy or transactional initialization; changing a load or squadron in Input clears the prior confirmation. No over-limit record is created.

## Integrity safeguards

- The Flight Alert roster is parsed in browser memory. Uploaded PDF contents and extracted source text are not persisted.
- Preserve merged SQD labels and source INTER/SECT order. Exclude the separate right-hand flight/squadron processing schedule.
- Validate recognized squadron, source dorm, explicit sex, integer load, section values, duplicate identities, and declared flight count before replacing the Input draft.
- Review precedes the existing canonical initialization. Existing Week Group closeout, archive, receiving-window, and D1 idempotency safeguards remain authoritative.
