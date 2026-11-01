#!/usr/bin/env bash
# DelayProof fresh-clone verification. Run from anywhere:
#   bash scripts/verify.sh
# 1 python venv + pinned tools   2 contract tests (direct mode: real GenVM SDK, web + LLM mocked)
# 3 genvm-lint check             4 genvm-lint typecheck
# 5 web npm ci + Chromium        6 web build      7 web offline tests (RPC blocked)
# Prints a PASS/FAIL table and exits non-zero on any failure. No keys, no network writes.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY="${PYTHON:-python3}"
export GENVM_VERSION="${GENVM_VERSION:-v0.2.16}"
declare -a NAMES=() RESULTS=()
step() {
  local name="$1"; shift
  echo; echo "==> $name"
  local t0=$SECONDS
  if "$@"; then RESULTS+=("PASS"); else RESULTS+=("FAIL"); echo "[verify] FAIL $name" >&2; fi
  NAMES+=("$name ($((SECONDS - t0))s)")
}
echo "DelayProof verify: $(date -u +%Y-%m-%dT%H:%M:%SZ)  python: $($PY --version 2>&1)  node: $(node --version 2>&1)"
step "setup: python venv + pinned requirements" bash -c "$PY -m venv .venv && .venv/bin/python -m pip install -q --upgrade pip && .venv/bin/python -m pip install -q -r requirements.txt"
step "contract tests (pytest, direct mode)" bash -c ".venv/bin/python -m pytest -q 2>&1 | tail -n 5; exit \${PIPESTATUS[0]}"
step "genvm-lint check" .venv/bin/genvm-lint check contracts/delay_proof.py
step "genvm-lint typecheck" bash -c "PATH=\"$ROOT/.venv/bin:\$PATH\" .venv/bin/genvm-lint typecheck contracts/delay_proof.py"
step "web: npm ci + Playwright Chromium" bash -c "cd web && npm ci --no-audit --no-fund --loglevel=error && npx --no-install playwright install chromium"
step "web build" bash -c "cd web && npm run --silent build"
step "web offline tests" bash -c "cd web && npm test 2>&1 | grep -E '^# (tests|pass|fail)|^not ok|^  error:'; exit \${PIPESTATUS[0]}"
echo; echo "================ SUMMARY ================"
fail=0
for i in "${!NAMES[@]}"; do printf '%-4s  %s\n' "${RESULTS[$i]}" "${NAMES[$i]}"; [ "${RESULTS[$i]}" = "PASS" ] || fail=1; done
echo "========================================="
[ $fail -eq 0 ] && echo "VERIFY: PASS" || echo "VERIFY: FAIL"
exit $fail
