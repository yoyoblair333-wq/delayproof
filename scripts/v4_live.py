#!/usr/bin/env python3
"""
v4_live.py - one full DelayProof v4 flow on GenLayer studionet, ending with a payout that
is CREDITED to the claimant's ClaimWallet contract (verified with eth_getBalance and the
wallet's own get_info, before and after).

    python scripts/v4_live.py [--state docs/live/run-6-v4.json] [--challenge 10]

Three throwaway keys are generated on first run and kept in `.keys/v4-live.json`
(git-ignored; testnet only, funded for free with Studio's sim_fundAccount):
  owner    deploys DelayProof v4 (the owner can never be a payer or a party)
  payer    creates and funds the demo pool, approves the claim
  claimant deploys its ClaimWallet, registers it, opens/assesses/finalizes, withdraws

The script is resumable: every step's tx hash and result is written to the state file
as soon as it is known, and a rerun skips the steps already done. Nothing is faked: it
records exactly what the chain returned and exits non-zero if the wallet was not credited.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time

from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus as S
from eth_account import Account
from web3 import Web3

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
KEYS = os.path.join(ROOT, ".keys", "v4-live.json")
WEI = 10**18

# Default claim: the flight that produced the first live OWED on v2/v3. FlightStats only serves
# roughly the last few days, so an older date comes back "DATE IS OUT OF RANGE" and the contract
# (correctly) rules INSUFFICIENT_DATA; pass --flight/--date for a recent delayed flight instead.
FR1029 = {"flight": "FR1029", "date": "2026-11-01",
          "evidence": ["https://www.bigodino.it/attualita/volo-ryanair-palermo-milano-passeggeri-fatti-scendere-per-sicurezza-sette-ore-di-ritardo.html"],
          "note": "Arrived over 9 hours late after a technical problem with the aircraft."}
POOL = {"name": "Demo card-perk pool (v4)", "regime": "ANY", "rate": 10**15, "days": 30, "max_per_flight": 1,
        "owed_only": False, "deposit": 2 * WEI}


def say(msg):
    print(f"[{dt.datetime.now(dt.timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def hexs(tx):
    h = tx.hex() if hasattr(tx, "hex") else str(tx)
    return h if h.startswith("0x") else "0x" + h


def jsonable(v):
    return json.loads(json.dumps(v, default=lambda x: x.hex() if isinstance(x, (bytes, bytearray)) else str(x)))


def load_keys():
    if os.path.exists(KEYS):
        with open(KEYS) as fh:
            return json.load(fh)
    os.makedirs(os.path.dirname(KEYS), exist_ok=True)
    keys = {r: "0x" + Account.create().key.hex().removeprefix("0x") for r in ("owner", "payer", "claimant")}
    with open(KEYS, "w") as fh:
        json.dump(keys, fh)
    os.chmod(KEYS, 0o600)
    return keys


class Run:
    def __init__(self, path):
        self.path = path
        self.s = json.load(open(path)) if os.path.exists(path) else {
            "network": "studionet (chain 61999, https://studio.genlayer.com/api)", "version": "v4",
            "startedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "steps": []}

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w") as fh:
            json.dump(jsonable(self.s), fh, indent=1)
            fh.write("\n")

    def step(self, label):
        return next((x for x in self.s["steps"] if x["step"] == label), None)


def submit(send, attempts=5):
    for i in range(attempts):
        try:
            return send()
        except Exception as e:
            if i == attempts - 1:
                raise
            say(f"  submit failed ({str(e)[:120]}); retrying in 10s")
            time.sleep(10)


def summarize(t):
    votes = sorted((t.get("consensus_data") or {}).get("votes", {}).values())
    lr = (t.get("consensus_data") or {}).get("leader_receipt")
    lr = lr[0] if isinstance(lr, list) and lr else (lr or {})
    blob = json.dumps(jsonable(t))
    err = None
    i = blob.find("[EXPECTED]")
    if i >= 0:
        err = blob[i:i + 160].split('"')[0].split("\\")[0]
    return {"status": t.get("status_name"), "result": t.get("result_name"), "execution": lr.get("execution_result"),
            "votes": votes, "error": err}


def wait_final(client, tx, until=S.FINALIZED, retries=400):
    client.wait_for_transaction_receipt(transaction_hash=tx, status=until, interval=5000, retries=retries)
    return client.get_transaction(tx)


def follow_children(client, t):
    out = []
    for child in t.get("triggered_transactions") or []:
        c = None
        for _ in range(240):
            try:
                c = client.get_transaction(child)
            except Exception:
                c = None
            if c and c.get("status_name") in ("FINALIZED", "UNDETERMINED", "CANCELED"):
                break
            time.sleep(5)
        c = c or {}
        out.append({"tx": hexs(child), **summarize(c), "to": c.get("to_address"), "value": str(c.get("value")),
                    "value_credited": c.get("value_credited")})
    return out


def do(run, client, label, fn, until=S.FINALIZED, children=False):
    done = run.step(label)
    if done and done.get("final", {}).get("status"):
        say(f"  (done) {label}: {done['tx']}")
        return done
    if done and done.get("tx"):
        tx = done["tx"]
    else:
        tx = hexs(submit(fn))
        done = {"step": label, "tx": tx, "sentAt": dt.datetime.now(dt.timezone.utc).isoformat()}
        run.s["steps"].append(done)
        run.save()
    say(f"  {label}: sent {tx}")
    t = wait_final(client, tx, until)
    done["final"] = summarize(t)
    if children:
        done["triggered"] = follow_children(client, t)
    run.save()
    say(f"  {label}: {done['final']}")
    for ch in done.get("triggered", []):
        say(f"    -> triggered {ch['tx']} {ch['status']} {ch['result']} to={ch['to']} value={ch['value']} credited={ch['value_credited']}")
    return done


def deploy(run, client, label, path, args):
    d = run.step(label)
    if d and d.get("contract"):
        say(f"  (done) {label}: {d['contract']}")
        return d["contract"]
    code = open(path, encoding="utf-8").read()
    d = do(run, client, label, lambda: client.deploy_contract(code=code, args=args))
    t = client.get_transaction(d["tx"])
    d["contract"] = (t.get("data") or {}).get("contract_address") or (t.get("tx_data_decoded") or {}).get("contract_address")
    run.save()
    say(f"  {label}: contract {d['contract']}")
    return d["contract"]


def bal(client, addr):
    return str(client.get_balance(Web3.to_checksum_address(addr)))


def canon_sha(text):
    t = text.replace("\r\n", "\n").rstrip("\n") + "\n"
    return hashlib.sha256(t.encode()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default=os.path.join(ROOT, "docs", "live", "run-6-v4.json"))
    ap.add_argument("--challenge", type=int, default=10, help="challenge window minutes for this deploy")
    ap.add_argument("--flight", default=FR1029["flight"])
    ap.add_argument("--date", default=FR1029["date"])
    ap.add_argument("--note", default=None)
    ap.add_argument("--evidence", default=None, help="JSON list of https URLs, or '' for none")
    a = ap.parse_args()
    same = a.flight == FR1029["flight"] and a.date == FR1029["date"]
    FLIGHT, DATE = a.flight, a.date
    NOTE = a.note if a.note is not None else (FR1029["note"] if same else "")
    EVIDENCE = json.loads(a.evidence) if a.evidence else (FR1029["evidence"] if same and a.evidence is None else [])
    run = Run(a.state)
    keys = load_keys()
    acct = {r: create_account(k) for r, k in keys.items()}
    cl = {r: create_client(chain=studionet, account=acct[r]) for r in acct}
    reader = cl["owner"]
    run.s["roles"] = {r: acct[r].address for r in acct}
    run.s["challenge_minutes"] = a.challenge
    run.save()
    say(f"roles: {run.s['roles']}")
    if not run.s.get("funded"):
        for r in acct:
            cl[r].fund_account(acct[r].address, 20 * WEI)
        run.s["funded"] = True
        run.save()

    dp_path = os.path.join(ROOT, "contracts", "delay_proof.py")
    w_path = os.path.join(ROOT, "contracts", "claim_wallet.py")
    dp = deploy(run, cl["owner"], "deploy DelayProof v4", dp_path, [a.challenge])
    run.s["contract"] = dp
    src = open(dp_path, encoding="utf-8").read()
    stored = reader.provider.make_request(method="gen_getContractCode", params=[dp]).get("result") or ""
    import base64
    stored_text = base64.b64decode(stored).decode("utf-8", "replace") if stored else ""
    run.s["source_sha256"] = canon_sha(src)
    run.s["stored_code_sha256"] = canon_sha(stored_text) if stored_text else None
    run.s["code_matches"] = run.s["source_sha256"] == run.s["stored_code_sha256"]
    run.s["config"] = reader.read_contract(address=dp, function_name="get_config", args=[])
    run.save()
    say(f"DelayProof v4 {dp} code_matches={run.s['code_matches']} version={run.s['config'].get('contract_version')}")

    wallet = deploy(run, cl["claimant"], "deploy ClaimWallet (claimant)", w_path, [])
    run.s["wallet"] = wallet
    run.s["wallet_info_initial"] = reader.read_contract(address=wallet, function_name="get_info", args=[])
    run.save()

    do(run, cl["claimant"], "set_payout_wallet (claimant registers its ClaimWallet)",
       lambda: cl["claimant"].write_contract(address=dp, function_name="set_payout_wallet", args=[wallet]))
    run.s["registered_wallet"] = reader.read_contract(address=dp, function_name="get_payout_wallet", args=[acct["claimant"].address])
    run.save()

    # guard: someone else cannot change the claimant's wallet (they can only set their own entry)
    do(run, cl["payer"], "guard: payer sets a wallet (only its own entry changes)",
       lambda: cl["payer"].write_contract(address=dp, function_name="set_payout_wallet", args=[acct["owner"].address]))
    run.s["registered_wallet_after_payer"] = reader.read_contract(address=dp, function_name="get_payout_wallet", args=[acct["claimant"].address])
    run.save()

    if not run.s.get("pool_id"):
        do(run, cl["payer"], "create_pool (payer, 2 GEN)",
           lambda: cl["payer"].write_contract(address=dp, function_name="create_pool",
                                              args=[POOL["name"], POOL["regime"], POOL["rate"], POOL["days"], POOL["max_per_flight"], POOL["owed_only"]],
                                              value=POOL["deposit"]))
        run.s["pool_id"] = int(reader.read_contract(address=dp, function_name="get_config", args=[])["next_pool"]) - 1
        run.save()
    pid = run.s["pool_id"]
    run.s["pool_before"] = reader.read_contract(address=dp, function_name="get_pool", args=[pid])
    run.save()

    if run.s.get("claim_id") and run.s.get("claim_flight") != f"{FLIGHT} {DATE}":
        # an earlier attempt on another flight stays on record (e.g. FR1029 out of FlightStats' window)
        run.s.setdefault("earlier_attempts", []).append({k: run.s.pop(k) for k in ("claim_id", "claim_flight", "claim_assessed", "error") if k in run.s})
    if not run.s.get("claim_id"):
        do(run, cl["claimant"], f"open_claim {FLIGHT} {DATE} (pool {pid})",
           lambda: cl["claimant"].write_contract(address=dp, function_name="open_claim",
                                                 args=[FLIGHT, DATE, NOTE, json.dumps(EVIDENCE), pid]))
        run.s["claim_id"] = int(reader.read_contract(address=dp, function_name="get_claim_id",
                                                     args=[FLIGHT, DATE, acct["claimant"].address]))
        run.s["claim_flight"] = f"{FLIGHT} {DATE}"
        run.save()
    cid = run.s["claim_id"]
    say(f"claim #{cid}")
    do(run, cl["claimant"], f"assess #{cid}", lambda: cl["claimant"].write_contract(address=dp, function_name="assess", args=[cid]))
    claim = reader.read_contract(address=dp, function_name="get_claim", args=[cid])
    run.s["claim_assessed"] = claim
    run.save()
    outcome = (claim.get("ruling") or {}).get("outcome")
    say(f"ruling: {outcome} {(claim.get('record') or {}).get('delay_min')} min {(claim.get('ruling') or {}).get('amount')}")
    if outcome not in ("OWED", "OWED_UNLESS_EXTRAORDINARY"):
        run.s["error"] = f"ruling {outcome} is not payable; stopping before approval"
        run.save()
        sys.exit(2)

    do(run, cl["payer"], f"approve_claim #{cid} (payer consent)",
       lambda: cl["payer"].write_contract(address=dp, function_name="approve_claim", args=[cid]))

    ends = dt.datetime.fromisoformat(claim["challenge_ends"].replace("Z", "+00:00"))
    wait = (ends - dt.datetime.now(dt.timezone.utc)).total_seconds() + 45
    if wait > 0 and not run.step(f"finalize #{cid} (claimant, after window)"):
        say(f"waiting {int(wait)}s for the challenge window ({claim['challenge_ends']})")
        time.sleep(wait)
    do(run, cl["claimant"], f"finalize #{cid} (claimant, after window)",
       lambda: cl["claimant"].write_contract(address=dp, function_name="finalize", args=[cid]))

    label = f"withdraw_payout #{cid} (to the ClaimWallet)"
    if not run.step(label):
        run.s["balances_before"] = {
            "wallet_eth_getBalance": bal(reader, wallet),
            "wallet_get_info": reader.read_contract(address=wallet, function_name="get_info", args=[]),
            "claimant_key": bal(reader, acct["claimant"].address),
            "delayproof_contract": bal(reader, dp),
            "at": dt.datetime.now(dt.timezone.utc).isoformat()}
        run.save()
    do(run, cl["claimant"], label,
       lambda: cl["claimant"].write_contract(address=dp, function_name="withdraw_payout", args=[cid]), children=True)
    time.sleep(10)
    run.s["balances_after"] = {
        "wallet_eth_getBalance": bal(reader, wallet),
        "wallet_get_info": reader.read_contract(address=wallet, function_name="get_info", args=[]),
        "claimant_key": bal(reader, acct["claimant"].address),
        "delayproof_contract": bal(reader, dp),
        "at": dt.datetime.now(dt.timezone.utc).isoformat()}
    run.s["claim_final"] = reader.read_contract(address=dp, function_name="get_claim", args=[cid])
    run.s["pool_after"] = reader.read_contract(address=dp, function_name="get_pool", args=[pid])
    delta = int(run.s["balances_after"]["wallet_eth_getBalance"]) - int(run.s["balances_before"]["wallet_eth_getBalance"])
    run.s["wallet_delta"] = str(delta)
    run.s["finishedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    run.save()
    say(f"wallet balance before {run.s['balances_before']['wallet_eth_getBalance']} after {run.s['balances_after']['wallet_eth_getBalance']} delta {delta}")
    sys.exit(0 if delta > 0 else 1)


if __name__ == "__main__":
    main()
