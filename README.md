# DelayProof

**Flight-delay compensation, decided by validator consensus instead of by the airline.**

A passenger enters a flight number and date. Validators hosted by GenLayer each fetch the
public flight record themselves and must agree on what happened (status, arrival delay
within 15 minutes, cause) and on the outcome a deterministic EU261/UK261 rules table gives
for it: owed, not owed, borderline, or owed unless the airline proves extraordinary
circumstances. The passenger, a payer covering the claim, or an airline address registered
with the project can appeal to a bigger panel. The passenger gets a shareable ruling and a
claim letter that cites the on-chain record. A card perk, insurer or travel group can fund
a testnet pool, approve the claims it covers, and pay them once the ruling is final.

Testnet only (GenLayer studionet). No real money. **Information, not legal advice.
Airlines are not bound by a DelayProof ruling.**

> **Deployment status (2026-11-01).** The site points at contract **v3**
> `0x0f68cF95e2E735D0b2AbD8a55de6890D2c0eBfe1` on studionet, deployed by the owner from
> Blair's wallet (`0x920fbbCf…a46A`, deploy tx `0xa7dd809f…6144`, challenge window 60 min).
> Its stored code matches `contracts/delay_proof.py` (canonical sha256 `4aaea346…480b`;
> check it yourself in `rig.html`). v2 `0x6F3dedC8…1FBF` is superseded and kept as history in
> [docs/LIVE_EVIDENCE.md](docs/LIVE_EVIDENCE.md).
>
> **First live OWED rulings.** Ryanair FR1029 Palermo → Milan Malpensa on 2026-11-01 arrived
> 9h 20m late (FlightStats) after a technical fault on the aircraft (news report quoting the
> airport operator). Validators agreed **OWED, €250** (EU261, 904 km): first on v2 (claim #7),
> then again on v3 (claim #1) with a different claimant. **Known gap:** on studionet the
> payout transfer to a plain wallet address fails (the network looks for a contract at that
> address), so a withdrawn payout leaves the pool but does not show in the wallet's balance.
> Details and tx hashes: [docs/LIVE_EVIDENCE.md](docs/LIVE_EVIDENCE.md).

> **Also in this repo: [ClaimCheck](docs/CLAIM_CHECK.md)**, a standalone, reusable k-of-n
> web-evidence quorum oracle (`contracts/claim_check.py`) that other contracts and apps can
> call to verify a claim against several independently fetched sources.

## The trust problem

- EU and UK law owe **€250–600 / £220–520 per passenger** when a flight lands 3+ hours
  late for a reason within the airline's control (EU261 + CJEU case law; UK261).
- The airline holds the flight data **and** decides whether to pay. A common answer is
  "extraordinary circumstances", which passengers can't check.
- Most eligible passengers never claim; claim firms keep **25–50%** of the payout
  (AirHelp's published fee is 35% incl. VAT, plus 15% if legal action is needed).
  Sources and confidence levels: [research/MARKET.md](research/MARKET.md).
- Asking a chatbot for a letter doesn't fix this: one company's model, unverifiable
  inputs, nothing the other side has to take seriously. Here several validators fetch the
  facts themselves and must agree, the rules are public code, and the ruling and its
  transaction history are public on studionet for anyone to check, including the airline.
  (Studionet is a test network; it can be reset, so this is not a permanent archive.)

## How it works

1. `open_claim(flight, date, note, evidence, pool_id)` checks inputs deterministically:
   flight code shape (IATA `BA117` or ICAO `LOG31`), a real date that is not in the future
   and under 6 years old, a public note without emails or booking references, and at most
   3 evidence links that must be `https://` on a public domain name (no IP addresses,
   localhost, internal hosts or booking pages). One claim per flight, date and claimant,
   where the flight key is the canonical airline code plus the number: IATA and ICAO
   spellings of the same airline (`BA117`, `BAW117`) and an operational suffix (`BA117A`)
   are the same flight, for airlines in the contract's `ICAO_TO_IATA` table. An airline
   missing from that table keeps its own spelling, so its two codes would still be two keys.
   Only the claimant can request the first `assess`.
2. `assess(claim_id)` runs one non-deterministic block. The leader fetches:
   - the route from adsbdb (airports, countries, coordinates, operating airline),
   - the **date-specific** FlightStats tracker page (scheduled and actual times): the only
     source allowed to set timing,
   - any attached evidence pages (skipped if larger than 1.5 MB).

   Then two kinds of analyst pass run (1 each; 3 or 5 on appeal):
   - **timing passes** see only the flight-status page and return status, arrival delay
     and the airports shown;
   - **cause passes** see the flight-status page, the agreed timing and the evidence pages,
     and return only the cause class.

   Web text is fenced with a per-transaction nonce. The nonce, fence brackets (`[[ ]]`,
   `<< >>`) and invisible characters are stripped from page text, so an evidence page
   can't forge a "flight-status" block. Every validator repeats
   the whole thing and accepts the leader's record only if the route, status, seen
   airports and cause match exactly, the delay is within 15 minutes, and the computed
   ruling (outcome, amount, currency, band, regime, flags) is identical. Records are
   whitelisted and size-capped; ties between analysts become UNKNOWN. The route database
   is only used when the airports the validators read on the status page match it: if
   they disagree (`route_conflict`) or the page shows no airports (`route_unconfirmed`),
   the ruling is INSUFFICIENT_DATA with no regime, distance or band, instead of a guessed
   route. The leader's free-text `reason`, `cause_label`, per-analyst lines and source
   `ok` flags are not compared by validators; the web app labels them "leader's notes".
3. `compute_ruling` (deterministic) applies [research/RULES.md](research/RULES.md):
   coverage (EU261 / UK261 by departure airport, arrival airport and carrier), great-circle
   distance band, the 3-hour threshold (≥180 min under EU261 + case law; >180 min under
   UK261 and, for flights from 2027-10-23, under Reg (EU) 2026/2202), the 50% cut for
   long-haul delays of 3–4 h (flagged `near_4h_line` from 225 min), the intra-EU medium
   cap, and BORDERLINE when the gate delay is within 15 minutes under the line (public data
   shows gate time, the law counts door-open). A flight that hasn't landed leaves the claim
   open to check again later.
4. `appeal(claim_id)` re-runs it with 3, then 5 analyst passes. Claimant evidence can only
   be added by the claimant; respondent evidence only by the linked pool's payer or the
   airline's registered respondent address.
   An appeal that comes back TOO_EARLY changes nothing and adds no history row.
5. `finalize`: any party (claimant, linked payer, registered respondent) can make a
   ruling final, but **nobody** can do it before the **challenge window** ends
   (`challenge_minutes`, set at deploy, 60 by default; read it with `get_config`;
   restarted by each appeal). The one exception is the top tier (5 analysts): no appeal
   is left, so it can be finalized at once.
6. Pools: `create_pool(name, regime, rate, days_valid, max_per_flight, owed_only)` is
   payable. The payer `approve_claim`s each claim it covers, and only while that claim's
   current ruling is one the pool pays (at most `max_per_flight` approved claims per
   canonical flight and date). Approval **reserves** the band's full amount: closing the
   pool (`set_pool_active(False)`, which only stops new links and approvals), expiry or a
   pause can't take it back, and `withdraw_payout` pays an approved, final, payable ruling
   once, even after expiry. If an approved claim ends final with a ruling the pool doesn't
   pay, the reservation and the per-flight slot are released. After expiry,
   `withdraw_pool` returns only the unreserved balance. A reservation whose claimant never
   withdraws stays locked (testnet trade-off, see QUALITY-R2).

### Roles and powers

| Role | Can | Cannot |
|---|---|---|
| Claimant | open, request the first assessment, appeal, add claimant evidence, finalize after the window, withdraw an approved payout | add respondent evidence, finalize inside the window |
| Pool payer | create/top up/close its pool, approve claims whose current ruling it pays, appeal and add respondent evidence on claims in its pool, finalize them after the window, reclaim unreserved funds after expiry | assess first, finalize inside the window, take back a reserved amount, touch other pools |
| Registered airline respondent | appeal, add respondent evidence and finalize after the window on its airline's claims (any spelling of the code) | assess first, finalize inside the window, anything else |
| Owner | pause, register a respondent address per airline code, transfer ownership | be a respondent or a payer (refused at registration and at `create_pool`, and every party check treats the current owner as a non-party), assess, appeal, finalize, or move anyone's money |

Pause blocks every claim and pool write except a payer reclaiming the **unreserved**
part of an expired pool, so a pause can delay an owed payout but can't hand it back to
the payer. The owner chooses who the respondent address is for each airline code; that is
still a trust step (the owner could register a friend's address), and a real deployment
would verify the address with the airline first. Reviews and fixes:
[docs/SECURITY-R1.md](docs/SECURITY-R1.md), [docs/QUALITY-R2.md](docs/QUALITY-R2.md);
regression tests in `tests/direct/test_security_r1.py` and `test_security_r2.py`.

## Verify in 5 minutes

Needs Python 3.12+, Node 20+, network for the first install. No keys, no network writes.

```bash
bash scripts/verify.sh
```

It builds `.venv` with pinned tools, runs the direct-mode contract tests on the real
GenVM v0.2.16 SDK (web and LLM mocked), `genvm-lint check` and `typecheck`, builds the
web app and runs its offline tests (unit + headless browser at 375 px, RPC blocked).
Expected ending: `VERIFY: PASS`.

## Live evidence

- Feasibility (can validators read flight data?): [docs/FEASIBILITY.md](docs/FEASIBILITY.md)
- Every transaction, status change and validator vote: [docs/LIVE_EVIDENCE.md](docs/LIVE_EVIDENCE.md)

## Web app

`web/` (esbuild). Reads use plain `fetch` JSON-RPC (`web/src/lib/rpc.js`, byte-for-byte
the same calls genlayer-js makes, checked in the tests); genlayer-js 1.1.8 and viem load
only when this browser signs a write. A per-browser testnet key signs `open_claim`,
`assess`, `appeal`, `add_evidence`, `finalize` and `withdraw_payout`; a status rail follows
each transaction through ACCEPTED to FINALIZED; the ruling is read back from the contract
and shown as a proof card with a claim letter. After a check, the page URL and the "Copy
link" button carry the deciding transaction (`?claim=N&tx=0x…`), and My trips links keep
it, so the recipient sees its validator votes; a bare `?claim=N` link (for example from
Recent rulings) shows the ruling without the votes, because the contract doesn't store the
tx hash. `rig.html` hashes the deployed code in your browser and compares it with the
pinned digest and the source file on `main`. `review.html` maps the GenLayer quality bar
to proof.

```bash
cd web && npm ci && npm run build && npx serve dist   # any static server
```

## Out of scope / honest limits

See [docs/FEASIBILITY.md](docs/FEASIBILITY.md#limits-stated-plainly): history window,
data licensing (testnet demo only; production needs a licensed feed), door-open vs gate
time, causes rarely public, one times source. US law has no cash delay compensation
(the DOT proposal was withdrawn in Nov 2025), so US-only routes return NOT_COVERED.

## Layout

| Path | What |
|---|---|
| `contracts/delay_proof.py` | the Intelligent Contract |
| `contracts/probe.py` | feasibility probe (throwaway) |
| `tests/direct/` | direct-mode tests (real SDK, web + LLM mocked) |
| `research/RULES.md`, `research/MARKET.md` | rules with sources; market research |
| `tools/live_run.mjs`, `tools/probe_live.mjs` | studionet evidence scripts |
| `docs/live/` | raw evidence JSON |
| `web/` | the web app |
