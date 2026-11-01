# DelayProof

**Flight-delay compensation, decided by validator consensus instead of by the airline.**

A passenger enters a flight number and date. GenLayer validators each fetch the public
flight record themselves, must agree on what happened (status, delay band, cause), and
a deterministic EU261/UK261 rules table turns that agreed record into a ruling: owed,
not owed, borderline, or owed unless the airline proves extraordinary circumstances.
Either side can appeal to a bigger panel. The passenger gets a shareable ruling and a
claim letter that cites the on-chain record. A card perk, insurer or travel group can
pre-fund a testnet pool that pays out automatically on a final "owed" ruling.

Testnet only (GenLayer studionet). No real money. **Information, not legal advice.
Airlines are not bound by a DelayProof ruling.**

## The trust problem

- EU and UK law owe **€250–600 / £220–520 per passenger** when a flight lands 3+ hours
  late for a reason within the airline's control (EU261 + CJEU case law; UK261).
- The airline holds the flight data **and** decides whether to pay. A common answer is
  "extraordinary circumstances", which passengers can't check.
- Most eligible passengers never claim; those who use a claim firm lose **25–50%**
  (AirHelp's published fee is 35% incl. VAT, +15% for legal action). Sources and
  confidence levels: [research/MARKET.md](research/MARKET.md).
- Asking a chatbot for a letter doesn't fix this: one company's model, unverifiable
  inputs, nothing the other side has to take seriously. Here the facts are fetched and
  agreed by independent validators, the rules are public code, and the record is
  permanent and checkable by anyone, including the airline.

## How it works

1. `open_claim(flight, date, note, evidence, pool_id)` checks inputs deterministically
   (flight code shape: IATA `BA117` or ICAO `LOG31`, real date, not in the future, under 6 years old, no
   instruction-like text in the note, at most 3 https evidence links).
2. `assess(claim_id)` runs one non-deterministic block. The leader fetches:
   - the route from adsbdb (airports, countries, coordinates, operating airline),
   - the **date-specific** FlightStats tracker page (scheduled and actual times),
   - any evidence pages either side attached,

   then runs 1 analyst pass (3 or 5 on appeal) that must return a bounded JSON verdict
   (status enum, delay minutes, cause class, and the departure and scheduled arrival
   airports it saw). This is where the AI judgement happens: reading unstructured pages,
   deciding whether a stated cause counts as "extraordinary circumstances", and weighing
   evidence pages from either side. Every validator repeats all of it and agrees only if
   the route, status, delay bucket, cause class and seen airports match. If the airports
   on the pages disagree with the route database, the ruling is INSUFFICIENT_DATA
   (`route_conflict`) instead of a wrong amount.
3. `compute_ruling` (deterministic, outside consensus) applies
   [research/RULES.md](research/RULES.md): coverage (EU261 / UK261 by departure airport,
   arrival airport and carrier), great-circle distance band, the 3-hour threshold
   (≥180 min under EU261 + case law; >180 min under UK261 and, for flights from
   2027-10-23, under Reg (EU) 2026/2202), the 50% cut for long-haul delays of 3–4 h,
   the intra-EU medium cap, and BORDERLINE when the gate delay is within 15 minutes under
   the line (public data shows gate time, the law counts door-open).
4. `appeal(claim_id)` re-runs it with 3, then 5 analyst passes. `add_evidence` lets the
   claimant or the airline attach public pages before the claim is final.
5. `finalize` → `withdraw_payout` pays the claimant once from a linked testnet pool
   (`create_pool` / `top_up_pool` are payable).

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

`web/` (esbuild, genlayer-js 1.1.8). A per-browser testnet key signs `open_claim`,
`assess` and `appeal`; a status rail follows each transaction from pending to agreed to
final; the ruling is read back from the contract and shown as a proof card with a
claim letter. `rig.html` hashes the deployed code in your browser and compares it with
the pinned digest. `review.html` maps the GenLayer quality bar to proof.

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
