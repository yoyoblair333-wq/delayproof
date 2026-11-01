#!/usr/bin/env python3
"""Render docs/LIVE_EVIDENCE.md from docs/live/*.json (run by hand after a live run)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE = ROOT / "docs" / "live"


def votes(v):
    return ", ".join(f"{k} {n}" for k, n in sorted((v or {}).items(), key=lambda x: -x[1])) or "-"


SOURCE_NOTES = {
    "FR1029": "Timing from the live FlightStats page for that date: scheduled arrival 09:25 CET, actual 18:45 CET (\"Arrived, Delayed by 9h 20m\"); departed 17:15 instead of 07:40. adsbdb gave PMO → MXP, matching the status page, so the route is confirmed. The cause came from the attached news page (Palermo airport operator Gesap: \"a technical problem with the Ryanair aircraft\", no security alarm): a technical fault is within the airline's control under CJEU case law, so the ruling is OWED. The agreed minutes differ between the two runs: 560 on v2 (actual arrival read as 18:45 CET, matching the page checked by hand) and 577 on v3 about 25 minutes later (the v3 reason gives actual arrival 19:02 CET; when checked by hand at about 18:15 UTC the page still said 18:45). Each run's validators read the page themselves and only have to agree with each other within 15 minutes; both readings are in the 4h+ band, so the ruling and amount are the same.",
    "BA117": "Timing from the live FlightStats page for that date (scheduled 12:20, actual 11:56 EDT: early). No evidence page. Pool-linked: the payer approved it, the claimant's finalize inside the 10-minute challenge window reverted, and the finalize after it succeeded; NOT_OWED, so no payout.",
    "LOG31": "Timing (cancelled) from FlightStats; the cause pass read the attached AirHelp page tying the cancellation to the Kirkwall ATC staffing closure. Appealed to 3 analysts per validator, who all agreed.",
    "SN3289": "FlightStats said DATE IS OUT OF RANGE. The attached page reports the cancellation, but in v2 evidence pages can't set timing, so the status is UNKNOWN and the ruling INSUFFICIENT_DATA. (Under v1 the same page produced POSSIBLY_OWED_CANCELLATION.) The page still informed the cause: crew illness, CONTROLLABLE.",
    "BA707": "FlightStats said DATE IS OUT OF RANGE, so timing is UNKNOWN and the ruling INSUFFICIENT_DATA; the attached page could only inform the cause (technical fault). Date checked against the page: it says the flight was \"scheduled to arrive on 19 October 2026\" (Larnaca to Heathrow, diverted to Gatwick, arrived after midnight), so 2026-10-19 is the scheduled date. The route database (adsbdb) returned ZRH → LHR for BA707; the status page showed no airports, so v2 had nothing to compare it with and did not flag it, and the ruling below still carries that unconfirmed route's EU261 regime and 788 km. The evidence page describes Larnaca → Heathrow, so the database route is wrong for this flight. Contract v3 (not yet deployed) makes such a ruling INSUFFICIENT_DATA with no regime or distance, and the web app no longer shows an unconfirmed route.",
    "ZZ9999": "No source knew the flight: FLIGHT_NOT_FOUND.",
}

V2_NOTE = ("All guards above reverted with the expected `[EXPECTED]` reason; ACCEPTED with ERROR is the final state for a revert. "
                "The claimant in this run is a fresh burner key; the payer is the throwaway test key. "
                "The demo pool (id 1) expires 2026-11-03T16:50:17Z (read live with `get_pool(1)` on 2026-11-01); after that the site "
                "disables the payout option. The first live OWED ruling (claim #7, FR1029) also ran on this v2 contract; see its own section above.\n")

V3_NOTE = ("This is the deployment the site uses. Blair deployed `contracts/delay_proof.py` (v3) from her own wallet with "
           "`challenge_minutes = 60`; `get_config` reads owner `0x920fbbCf2106B693A857D1995c198e341220a46A` and challenge window 60, and "
           "the stored code's canonical sha256 (CRLF → LF, one final newline, the rule `rig.html` uses) equals the source file's. "
           "Every transaction after the deploy was signed by test keys, not the owner wallet: the demo pool (id 1, the one the site offers) was created and "
           "funded with 2 testnet GEN by the throwaway payer key, which also approved the claim, and the claim was opened, assessed, "
           "finalized and withdrawn by a fresh claimant burner. The withdraw had to wait out the full 60-minute challenge window. "
           "FR1029 is the same flight that produced the first live OWED on v2 (next section), re-run on v3 by a different claimant.\n")

V3 = {"deployer": "0x920fbbCf2106B693A857D1995c198e341220a46A", "deployer_note": "Blair's wallet; `get_config` names it as owner",
      "deploy": {"tx": "0xa7dd809f9a85206cf2ab19d22e71f5edad0855d244684f7042a79934264d6144", "final": {"status": "FINALIZED"}},
      "owner_deploy": True}


def payout_check(w, chk, fname):
    w.append("### Did the test payout arrive? Not on studionet\n")
    w.append(f"`withdraw_payout` finalized with SUCCESS and queued a transfer of {int(chk['transfer_value']) / 1e18:g} GEN to the claimant "
             f"(`{chk['transfer_to']}`). The pool's balance dropped from 2.0 to 1.75 GEN and the contract's `eth_getBalance` reads "
             f"{int(chk['contract_balance_wei']) / 1e18:g} GEN (it was funded with 2.0 for this one pool), so the money left the contract.But the claimant's `eth_getBalance` stayed at "
             f"{int(chk['claimant_balance_wei']) / 1e18:g} GEN before, after and in later checks. Reading the transfer the withdraw triggered "
             f"(`{chk['triggered_transfer_tx']}`) shows why: status {chk['transfer_status']}, result {chk['transfer_result']}, execution "
             f"{chk['transfer_execution']}, handled by `{chk['transfer_handler']}` with the message \"{chk['transfer_message']}\", and "
             f"`value_credited: {str(chk['transfer_value_credited']).lower()}`. Studionet treated a transfer to a plain wallet address as a call "
             "to a missing contract, so **the payout was recorded and debited but not credited to the wallet**. Raw facts: "
             f"`docs/live/{fname}`. Until that changes, a \"paid\" claim on this site means the contract recorded the "
             "payout and released it from the pool, not that the GEN reached the wallet.\n")



def render(run, w, heading):
    w.append(heading)
    w.append("| Item | Value |\n|---|---|")
    w.append(f"| Contract | `{run['contract']}` |")
    dep = run.get("deploy") or {}
    w.append(f"| Deploy tx | `{dep.get('tx', '-')}` ({(dep.get('final') or {}).get('status', '-')}) |")
    w.append(f"| Deployer | `{run['deployer']}` ({run.get('deployer_note', 'throwaway test key, not the owner wallet')}) |")
    w.append(f"| Source | `contracts/delay_proof.py`, sha256 `{run['contract_code_sha256']}` |")
    w.append(f"| Stored code sha256 | `{run.get('stored_code_sha256')}` ({'MATCH' if run.get('code_matches') else 'MISMATCH'}) |")
    if run.get("challenge_minutes"):
        w.append(f"| Challenge window | {run['challenge_minutes']} min{' (owner deploy)' if run.get('owner_deploy') else ' (short for this throwaway run; the owner deploy uses 60)'} |")
        w.append(f"| Roles | payer `{run.get('payer')}` (throwaway test key), claimant `{run.get('claimant')}` (fresh burner key) |")
    w.append(f"| Run | {run['startedAt']} → {run.get('finishedAt', '(unfinished)')} |\n")
    w.append("### Transactions\n")
    w.append("| Step | Tx | Final status | Consensus | Execution | Validators | Note |\n|---|---|---|---|---|---|---|")
    for s in run["steps"]:
        f = s.get("final") or {}
        label = s["label"]
        if run.get("_current") and "route database disagrees" in label:
            # the label was written before this run; on v2 the status page showed no airports, so nothing disagreed on-chain
            label = label.replace("route database disagrees", "label written before the run: on v2 the route was unconfirmed, not in conflict")
        w.append(f"| {label} | `{s.get('tx', '-')}` | {f.get('status', '-')} | {f.get('result', '-')} | {f.get('execution', '-')} | {votes(f.get('votes'))} | {f.get('error') or s.get('error', '') or ''} |")
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
            seen = str(rec.get("seen_route") or "-").split("-")
            if route and len(seen) == 2 and seen == [route.get("origin"), route.get("dest")]:
                w.append(f"- Route (database, confirmed by the status page): {route.get('origin')} → {route.get('dest')} ({route.get('airline_name', '')})")
            elif route:
                why = "showed different airports" if len(seen) == 2 and seen[0] and seen[1] else "showed no airports"
                w.append(f"- Route database (adsbdb) said {route.get('origin', '?')} → {route.get('dest', '?')} ({route.get('airline_name', '')}); "
                         f"**not confirmed**: the status page {why}, so this route is not a fact about the flight")
            else:
                w.append("- Route: unknown (the route database had no entry)")
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
             "The current deployment (v3) was deployed by the owner from Blair's wallet; every earlier one was from a throwaway test key. "
             "Pools, claims and approvals below are always signed by test keys (a throwaway payer and a fresh claimant burner per run).\n")
    v3 = LIVE / "run-5-v3.json"
    if v3.exists():
        cur3 = {**json.loads(v3.read_text()), **V3, "_current": True}
        render(cur3, w, "## Current deployment (2026-11-01, contract v3, owner deploy from Blair's wallet)\n")
        w.append(V3_NOTE)
        chk3 = LIVE / "run-5-v3-payout-check.json"
        if chk3.exists():
            payout_check(w, json.loads(chk3.read_text()), "run-5-v3-payout-check.json")
    owed = LIVE / "run-4b-owed-fr1029.json"
    if owed.exists():
        o = json.loads(owed.read_text())
        o["_current"] = True
        render(o, w, "## First live OWED ruling (2026-11-01, claim #7 on the v2 contract `0x6F3dedC8…1FBF`, now superseded)\n")
        w.append("Run on v2 before v3 was deployed, with a one-claim plan (`DP_ADDRESS` = v2, `DP_POOL_ID=1`). The table's Deploy tx is blank "
                 "because this invocation reused the v2 deployment listed further down. The flight was found in the news the same day: "
                 "FR1029 was postponed after passengers boarded and were taken off again.\n")
        chk = LIVE / "run-4b-payout-check.json"
        if chk.exists():
            payout_check(w, json.loads(chk.read_text()), "run-4b-payout-check.json")
    cur = json.loads((LIVE / "run-4.json").read_text())
    cur["_current"] = True
    render(cur, w, "## Superseded deployment (2026-11-01, contract v2 after the round-1 security review, throwaway test key)\n")
    w.append(V2_NOTE)
    prev = json.loads((LIVE / "run-3.json").read_text())
    render(prev, w, "## Previous deployment (2026-11-01, `0xAC6b99E9…a31f`, v1, superseded by v2)\n")
    w.append("Under v1 an attached page could set timing (SN3289 and BA707 above). v2 refuses that by design; see the v2 section.\n")
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
