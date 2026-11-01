#!/usr/bin/env python3
"""Render docs/LIVE_EVIDENCE.md from docs/live/*.json (run by hand after a live run)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "docs" / "live"


def votes(v):
    return ", ".join(f"{k} {n}" for k, n in sorted((v or {}).items(), key=lambda x: -x[1])) or "-"


SOURCE_NOTES = {
    "BA117": "Timing from the live FlightStats page for that date (scheduled 12:20, actual 11:56 EDT: early). No evidence page. Pool-linked: the payer approved it, the claimant's finalize inside the 10-minute challenge window reverted, and the finalize after it succeeded; NOT_OWED, so no payout.",
    "LOG31": "Timing (cancelled) from FlightStats; the cause pass read the attached AirHelp page tying the cancellation to the Kirkwall ATC staffing closure. Appealed to 3 analysts per validator, who all agreed.",
    "SN3289": "FlightStats said DATE IS OUT OF RANGE. The attached page reports the cancellation, but in v2 evidence pages can't set timing, so the status is UNKNOWN and the ruling INSUFFICIENT_DATA. (Under v1 the same page produced POSSIBLY_OWED_CANCELLATION.) The page still informed the cause: crew illness, CONTROLLABLE.",
    "BA707": "FlightStats said DATE IS OUT OF RANGE, so timing is UNKNOWN and the ruling INSUFFICIENT_DATA; the attached page could only inform the cause (technical fault). Date checked against the page: it says the flight was \"scheduled to arrive on 19 October 2026\" (Larnaca to Heathrow, diverted to Gatwick, arrived after midnight), so 2026-10-19 is the scheduled date.",
    "ZZ9999": "No source knew the flight: FLIGHT_NOT_FOUND.",
}

CURRENT_NOTE = ("No live claim has reached OWED yet: no flight in FlightStats' free 3-day window arrived 3+ hours late on a covered route "
                "during the runs. The OWED payout path (approve, window, finalize, withdraw) is covered by the direct-mode tests. "
                "All guards above reverted with the expected `[EXPECTED]` reason; ACCEPTED with ERROR is the final state for a revert. "
                "The claimant in this run is a fresh burner key; the payer is the throwaway test key.\n")


def render(run, w, heading):
    w.append(heading)
    w.append("| Item | Value |\n|---|---|")
    w.append(f"| Contract | `{run['contract']}` |")
    dep = run.get("deploy") or {}
    w.append(f"| Deploy tx | `{dep.get('tx', '-')}` ({(dep.get('final') or {}).get('status', '-')}) |")
    w.append(f"| Deployer | `{run['deployer']}` (throwaway test key, not Blair's wallet; owner deploy is a later step) |")
    w.append(f"| Source | `contracts/delay_proof.py`, sha256 `{run['contract_code_sha256']}` |")
    w.append(f"| Stored code sha256 | `{run.get('stored_code_sha256')}` ({'MATCH' if run.get('code_matches') else 'MISMATCH'}) |")
    if run.get("challenge_minutes"):
        w.append(f"| Challenge window | {run['challenge_minutes']} min (short for this throwaway run; the owner deploy uses 60) |")
        w.append(f"| Roles | payer `{run.get('payer')}` (throwaway test key), claimant `{run.get('claimant')}` (fresh burner key) |")
    w.append(f"| Run | {run['startedAt']} → {run.get('finishedAt', '(unfinished)')} |\n")
    w.append("### Transactions\n")
    w.append("| Step | Tx | Final status | Consensus | Execution | Validators | Note |\n|---|---|---|---|---|---|---|")
    for s in run["steps"]:
        f = s.get("final") or {}
        w.append(f"| {s['label']} | `{s.get('tx', '-')}` | {f.get('status', '-')} | {f.get('result', '-')} | {f.get('execution', '-')} | {votes(f.get('votes'))} | {f.get('error') or s.get('error', '') or ''} |")
    w.append("")
    for c in run.get("claims", []):
        r, rec = c.get("ruling") or {}, c.get("record") or {}
        w.append(f"### Claim #{c['id']}: {c['flight']} on {c['date']}\n")
        if c['flight'] in SOURCE_NOTES and run.get("_current"):
            w.append(f"- **Which source decided:** {SOURCE_NOTES[c['flight']]}")
        if c.get("evidence"):
            w.append("- Evidence attached: " + ", ".join(f"{e['side']} {e['url']}" for e in c["evidence"]))
        if rec.get("seen_route"):
            w.append(f"- Airports the analysts agreed they saw: {rec.get('seen_route')}")
        w.append(f"- Status: **{c['status']}**, tier {c['tier']} ({c['analysts']} analyst pass(es) per validator)")
        if rec:
            route = rec.get("route") or {}
            w.append(f"- Agreed record: {rec.get('status')}, delay {rec.get('delay_min')} min ({rec.get('bucket')}), cause {rec.get('cause_class')} ({rec.get('cause_label')})")
            w.append(f"- Route: {route.get('origin', '?')} → {route.get('dest', '?')} ({route.get('airline_name', '')})")
            w.append(f"- Sources each validator loaded: " + ", ".join(f"{s['name']} {'ok' if s['ok'] else 'FAILED'}" for s in rec.get("sources", [])))
            w.append(f"- Analysts: " + "; ".join(f"{a['status']} {a['delay_min']} min {a['cause_class']}" for a in rec.get("analysts", [])))
            w.append(f"- Reason given: \"{rec.get('reason', '')}\"")
        if r:
            w.append(f"- **Ruling: {r.get('outcome')}** — {r.get('explanation')} Regime {r.get('regime') or '-'}, rule set \"{r.get('rule_set') or '-'}\", "
                     f"distance {r.get('distance_km')} km, band {r.get('band') or '-'}, amount {r.get('amount')} {r.get('currency') or ''}")
        if c.get("history"):
            w.append(f"- Earlier tiers: " + "; ".join(f"tier {h['tier']}: {h['ruling'].get('outcome')} ({h['record'].get('bucket')}, {h['record'].get('cause_class')})" for h in c["history"]))
        w.append("")
    if run.get("pool"):
        w.append("### Testnet pool\n")
        w.append(f"- Pool before: `{json.dumps(run['pool'])}`")
        if run.get("pool_after"):
            w.append(f"- Pool after: `{json.dumps(run['pool_after'])}`")
        w.append("")



def main():
    w = []
    w.append("# Live evidence (GenLayer studionet)\n")
    w.append("Generated by `scripts/live_evidence.py` from `docs/live/*.json`. Every hash below can be looked up on studionet "
             "(`eth_getTransactionByHash` / `gen_getContractCode` at https://studio.genlayer.com/api). Testnet only, no real money. "
             "All deployments so far are from a throwaway test key; the owner deployment from Blair's wallet is a later step.\n")
    cur = json.loads((LIVE / "run-4.json").read_text())
    cur["_current"] = True
    render(cur, w, "## Current deployment (2026-11-01, contract v2 after the round-1 security review)\n")
    w.append(CURRENT_NOTE)
    prev = json.loads((LIVE / "run-3.json").read_text())
    render(prev, w, "## Previous deployment (2026-11-01, `0xAC6b99E9…a31f`, v1, superseded by v2)\n")
    w.append("Under v1 an attached page could set timing (SN3289 and BA707 above). v2 refuses that by design; see the current deployment.\n")
    old = json.loads((LIVE / "run-1.json").read_text())
    render(old, w, "## Earlier deployment (2026-11-01, `0x76b28bDC…4BC45`, superseded)\n")
    ladder = LIVE / "run-2-ladder.json"
    if ladder.exists():
        r2 = json.loads(ladder.read_text())
        w.append("### Appeal ladder to the top tier (browser claim #4, earlier deployment)\n")
        w.append("Second invocation of `tools/live_run.mjs` (`docs/live/run-2-ladder.json`) on the same contract: the airline-side evidence slot, "
                 "both appeals, and an appeal past the top tier that must revert.\n")
        w.append("| Step | Tx | Final status | Execution | Validators | Note |\n|---|---|---|---|---|---|")
        for st in r2["steps"]:
            f = st.get("final") or {}
            w.append(f"| {st['label']} | `{st.get('tx', '-')}` | {f.get('status', '-')} | {f.get('execution', '-')} | {votes(f.get('votes'))} | {f.get('error') or ''} |")
        for c in r2.get("claims", []):
            rec, r = c.get("record") or {}, c.get("ruling") or {}
            w.append("")
            w.append(f"- Claim #{c['id']} {c['flight']} {c['date']}: tier {c['tier']} ({c['analysts']} analysts per validator), "
                     f"analysts: " + "; ".join(f"{a['status']} {a['delay_min']} min {a['cause_class']}" for a in rec.get("analysts", [])))
            w.append(f"- Sources: " + ", ".join(f"{s2['name']} {'ok' if s2['ok'] else 'FAILED'}" for s2 in rec.get("sources", [])))
            w.append(f"- Ruling: **{r.get('outcome')}**; earlier tiers: " + "; ".join(f"tier {h['tier']} {h['ruling'].get('outcome')}" for h in c.get("history", [])))
        w.append("")
    b = LIVE / "browser-run.json"
    if b.exists():
        br = json.loads(b.read_text())
        w.append("### Browser-signed claim (earlier deployment)\n")
        w.append(f"Built page in headless Chromium, burner key generated in the browser, `{br.get('flight')}` on {br.get('date')}: "
                 f"{'**' + (br.get('headline') or '').strip() + '**' if br.get('headline') else 'FAILED: ' + str(br.get('error'))} in {br.get('seconds')} s. "
                 "Raw record: `docs/live/browser-run.json`; screenshot `docs/live/browser-run.png`.\n")
    (ROOT / "docs" / "LIVE_EVIDENCE.md").write_text("\n".join(w) + "\n")
    print("wrote docs/LIVE_EVIDENCE.md")


if __name__ == "__main__":
    main()
