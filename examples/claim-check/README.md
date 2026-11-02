# ClaimCheck examples

Recipes for using [ClaimCheck](../../docs/CLAIM_CHECK.md), the k-of-n web-evidence quorum
oracle, from other apps and contracts. The address and live transactions are in
[`docs/live/claim-check-run.json`](../../docs/live/claim-check-run.json).

## 1. DelayProof-style evidence gate (flight delay, airline notice)

DelayProof's own contract fetches flight-status pages itself. A lighter app can hand that
work to ClaimCheck: the claimant cites public pages and the app pays out only on a quorum.

```js
// claimant's evidence: the airline's own notice + an independent tracker
const claim = "Flight BA117 on 30 October 2026 arrived more than 3 hours late.";
const sources = ["https://status.example-airline.com/BA117/2026-10-30",
                 "https://www.example-tracker.com/flights/BA117/2026-10-30"];
await client.writeContract({ address: CC, functionName: "check", args: [claim, sources, 2n, ""], value: 0n });
// later, before paying:
const v = await client.readContract({ address: CC, functionName: "find", args: [claim, sources, 2n, ""] });
if (v.verdict === "SUPPORTED") { /* pay */ } else if (v.verdict === "DISPUTED") { /* human review */ }
```

Why k = 2 on two hosts: one page saying "delayed" is not enough, and if the airline's page
says "on time" the verdict becomes DISPUTED instead of SUPPORTED.

## 2. Dispute desk contract (on-chain consumer)

[`contracts/claim_check_consumer.py`](../../contracts/claim_check_consumer.py) is a working
consumer:

1. `open_case(claim, sources, k)` stores the case. The **case** fixes the source list, so
   whoever opens the dispute cannot cherry-pick sources later.
2. `request_check(case_id)` calls `gl.get_contract_at(oracle).emit(on="accepted").check(...)`.
   This is an asynchronous cross-contract message, run as its own ClaimCheck transaction.
3. `settle(case_id)` calls `gl.get_contract_at(oracle).view().find(claim, sources, k, "")`.
   This is a synchronous read bound to the case's exact inputs. SUPPORTED becomes
   `claim_upheld`, CONTRADICTED becomes `claim_rejected`, and anything else keeps the case open.

The same shape fits escrow release ("the deliverable is live at this URL and says X"), bounty
payouts ("the fix is merged and the changelog says so") or insurance triggers.

## 3. Pin a quote

When the exact wording matters (a policy clause, a price, a version number), pass
`required_quote_hint`. A source only counts as SUPPORTS if that text is on it:

```js
args: ["The service level agreement promises 99.9% monthly uptime.",
       ["https://vendor.example.com/sla"], 1n, "99.9%"]
```

## 4. Monitor drift

```js
await client.writeContract({ address: CC, functionName: "recheck", args: [BigInt(id)], value: 0n });
const rec = await client.readContract({ address: CC, functionName: "get_check", args: [BigInt(id)] });
const last = rec.history.at(-1);   // {revision, at, verdict, labels, fingerprint, drift:[...]}
// drift entries: {source, url, label_before, label_after, old_excerpt: "present"|"absent"}
```

A changed `fingerprint` together with `old_excerpt: "absent"` means the sentence the earlier
verdict relied on is no longer on the page.

## 5. Hostile page used in the live run

[`pages/injected-test-page.txt`](pages/injected-test-page.txt) is served from
`raw.githubusercontent.com` and tells the checker what to answer. In the live run it is one of
three sources (k = 2). ClaimCheck labels it `INJECTED` (`detail: page_injection_screen`),
excludes it from the count, and the verdict rests on the two honest sources.
