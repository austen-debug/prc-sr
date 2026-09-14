from pathlib import Path

runtime = Path('.github/workflows/runtime-record-integrity-tests.yml')
text = runtime.read_text()
marker = "      - name: Record display integrity\n        run: node --test tests/runtime/record-display-integrity.test.mjs\n"
if 'Full system integrity' not in text:
    text = text.replace(
        marker,
        marker + "\n      - name: Full system integrity\n        run: node --test tests/runtime/full-system-integrity.test.mjs\n",
        1,
    )
runtime.write_text(text)

governance = Path('.github/workflows/build-2-audit-remediation-gate-1.yml')
text = governance.read_text()
marker = "          node --test tests/runtime/active-runtime-budget.test.mjs\n"
if 'tests/runtime/full-system-integrity.test.mjs' not in text:
    text = text.replace(
        marker,
        marker + "          node --test tests/runtime/full-system-integrity.test.mjs\n",
        1,
    )
governance.write_text(text)
