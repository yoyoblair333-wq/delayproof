# DelayProof security review, round 1

Date: 2026-11-01. Scope: `contracts/delay_proof.py` (sha256 pinned in `web/src/config.js`), `web/src/**`, tests, docs.
Deployment: studionet `0xAC6b99E93afa612E50F2E687F8088B5a4289a31f` (testnet, no real money).
Method: line-by-line read, `bash scripts/verify.sh` (all 7 steps PASS; 104 contract tests, 17 web tests), and six
throwaway direct-mode proof-of-concept tests kept outside the repo
(`/tmp/claude-0/-home-claude/c3dd378d-e8cf-5884-b5cd-0c7a7db98c00/scratchpad/poc/test_poc.py`, all 6 pass against the unmodified contract).
No repo code was changed.

## Status after polish round 1 (contract v2)

Every P0 and P1 below is fixed in `contracts/delay_proof.py` v2. The six PoCs are ported to
`tests/direct/test_security_r1.py` and now assert that each exploit **fails**. The new live
deployment and its transactions are in [LIVE_EVIDENCE.md](LIVE_EVIDENCE.md).

| Finding | Fix | Regression test |
|---|---|---|
| P0-1 pool drain | Payer must `approve_claim` each claim; at most `max_per_flight` approved claims per (pool, flight, date); one claim per (flight, date, claimant); claimant finalizes only after a challenge window (default 60 min, restarted by appeals) | `TestPoolDrain::test_poc1_duplicate_claims_no_longer_drain` and 10 more |
| P0-2 evidence writes the record | Separate timing passes (flight-status pages only) and cause passes (may read evidence); per-tx nonce fences; `<<`/`>>` and the nonce stripped from page text; `timing_source` recorded | `TestTimingIsolation` (PoC 3 twice, plus "timing prompt has no evidence") |
| P0-3 anyone fills respondent slots | Respondent evidence only from the linked payer or an owner-registered airline respondent address | `TestRespondentAuth` (PoC 2) |
| P1-1 leader picks the minute | Validators compare minutes within ±15 **and** the full computed ruling (outcome, amount, currency, band, regime, flags) | `TestConsensusHardening::test_poc4_*`, `test_minutes_beyond_tolerance_rejected` |
| P1-2 unchecked leader fields | Exact route equality; whitelisted record and route keys; reason ≤ 400, label ≤ 60; analyst count and source names must match | `test_poc5_forged_records_rejected` (9 variants incl. PoC 6 coordinate shift) |
| P1-3 locked payer funds | Pools have an expiry; `withdraw_pool` after expiry; `set_pool_active`; only the payer tops up | `TestPoolExpiry` |
| P1-4 owner/relayer are parties | Relayer removed; owner can only pause, register respondents and transfer ownership; parties are claimant, linked payer, registered respondent | `test_owner_cannot_act_on_claims` |
| P1-5 "final" at ACCEPTED | Web app polls to FINALIZED; ACCEPTED is shown as "accepted, waiting for it to be final" | web offline tests |
| P1-6 personal data on-chain | Contract refuses emails and booking references in the note and booking-page evidence URLs | `test_note_personal_data_refused`, `TestEvidenceUrls` |
| P1-7 unbounded fetches | Evidence URL host checks (no IPs, localhost, internal names); pages over 1.5 MB not rendered; non-parties can't trigger assessments or add evidence | `test_oversized_evidence_not_rendered`, `TestEvidenceUrls` |
| P2-1 dead note guard | Removed; the note is documented as public text never shown to analysts | `test_note_is_never_shown_to_analysts` |
| P2-2 alphabetical ties | Any tie → UNKNOWN | `test_tie_is_unknown`, `test_cause_tie_is_unknown` |
| P2-3 pause | Pause blocks every claim and pool write except reclaiming an expired pool | `TestPause` |
| P2-4 spam pushes claims out | `list_recent(limit, before_id)` paginates; rate limit/bond still open | — |
| P2-9 no CSP | CSP meta on every page | web offline test |
| P2-10 unescaped ids | Escaped / coerced to numbers | — |
| P2-12 rig MATCH when source unreachable | Says "matches this site's pinned digest; source file not compared" | — |
| Still open | P2-5 (agreeing on leader errors), P2-6 (require `seen_route` for payable outcomes), P2-7 (claim id from tx return), P2-8 (burner key in localStorage, testnet only), P2-11 (upstream packaging), P2-13 (contract recipients) | — |

Severity: **P0** = breaks the core promise (money or ruling integrity) cheaply, today. **P1** = real exploit or
integrity gap with some cost or precondition. **P2** = hardening, defence in depth, honesty wording.

---

## P0

### P0-1. Any pool can be drained by repeat or non-passenger claims on one delayed flight
`delay_proof.py:654-676` (open_claim), `:728-736` (finalize), `:759-786` (withdraw_payout)

- `open_claim` lets anyone link any `pool_id` (`:666-667`). The payer never consents to a claim.
- Nothing ties a claim to a passenger, and there is no uniqueness on (claimant, flight, date) or (flight, date).
- The claimant is a "party", so they can `finalize` straight after the 1-analyst tier (`:733`). The payer gets no window to appeal.
- `OWED_UNLESS_EXTRAORDINARY` is payable (`:92`). That is the default outcome for any 3h+ delay on a covered route with no public cause, so the pool pays out without the AI judging anything.

**Exploit.** Find one real covered flight that arrived 3h+ late (FlightStats shows the last 3 days). From one address, or from many free burner keys, loop `open_claim(flight, date, "", "", pool)` → `assess` → `finalize` → `withdraw_payout`. PoC 1: four claims on BA117 from two addresses (one of them never claimed to be on board) drained a 20,800-unit pool to 0.

**Fix (all of these are needed):**
1. Make pools opt-in per claim. The payer allowlists claimants, or co-signs `link_claim(claim_id)`, or the pool requires an attestation (a signed booking proof from the payer's own system).
2. Allow at most one payable claim per (pool, flight, date, claimant). Add a per-pool cap on claims per (flight, date), sized to seat count.
3. Add a challenge window. `finalize` reverts until N blocks/minutes after the latest assess/appeal, and only the payer can finalize early.
4. Let the pool set which outcomes it pays (for example OWED only), plus a per-claim cap and an expiry.

### P0-2. Attacker-controlled evidence can write the flight record, including fake "source" blocks
`delay_proof.py:400-428` (prompt), `:410-413` (fences), `:610-618` (evidence render), `:109` (MAX_CLAIM_AGE_DAYS), `web/src/index.html:52`

- The fences are plain text (`<<<SOURCE name>>>` … `<<<END SOURCE name>>>`). Page text is pasted in unescaped. An evidence page can close its own block and open a fake `<<<SOURCE flightstats (loaded)>>>` containing invented scheduled and actual times. PoC 3 proves the spoofed block reaches the prompt verbatim and the claim rules OWED.
- Claims up to 6 years old are accepted (`:109`), but FlightStats only covers ±3 days (docs/FEASIBILITY.md:41). For every older claim, evidence pages are the **only** timing source. The UI pushes users into this ("Older flight? Add a public evidence link", index.html:52). LIVE_EVIDENCE.md:67 confirms an attached page decided claim #3 on its own.
- Hidden text is not removed. `render(mode="text")` keeps text that is off-screen, 1px, or white-on-white, and anything inside `<noscript>`/`aria-label`. CONTROL_PATTERNS are never applied to web text.
- Validators agree because they all read the same lie. Consensus does not protect against a consistent fake.

**Fix:**
1. Generate a random per-transaction nonce from tx data (identical for leader and validators) and use it in the fence tokens: `<<<EVIDENCE-7f3a…>>>`. Strip any `<<<`/`>>>` sequences and the nonce from page text before inserting it.
2. Separate the roles. Timing (`status`, `arrival_delay_min`) must come only from allowlisted flight-status hosts. Evidence pages may only move `cause_class`. Do this in code, not in the prompt: run a second analyst pass that sees only the status pages for the timing fields, or have the analyst return per-field `source_id`s and reject timing taken from evidence.
3. Refuse payable outcomes (or cap them at BORDERLINE/INSUFFICIENT_DATA) when no allowlisted status source loaded with this flight on this date. Reduce MAX_CLAIM_AGE_DAYS to the status-source window until a licensed historical feed exists.
4. Allowlist evidence domains (airline, airport, ATC/Eurocontrol, major news), or at least label non-allowlisted evidence as "unverified" in the record.

### P0-3. Anyone can fill a claim's respondent slots, block the airline, and inject "extraordinary" evidence
`delay_proof.py:678-694` (no auth for `side == "respondent"`, `:686-688`)

- Any address can add up to 3 "respondent" URLs to any non-final claim. PoC 2: a stranger filled all 3 slots, and the real payer's `add_evidence` then reverts with "at most 3 evidence URLs per side".
- Griefing pages can (a) claim an ATC strike to push `cause_class` to EXTRAORDINARY, which flips the claim to not owed, or (b) serve different content per fetch, so validators disagree and the assessment ends UNDETERMINED or times out. Claimants have to pay for repeated failed `assess` calls.
- README.md:55 and index.html:116 say evidence comes from "the claimant or the airline". In fact it comes from anyone.

**Fix:** Respondent evidence may only be added by the linked pool's payer, the owner, or an allowlisted respondent registry (per airline code). Make slots per-address, or let the claimant/payer remove entries before assess. Freeze evidence a set time before `assess` so it can't be front-run.

---

## P1

### P1-1. A malicious leader picks the exact minute inside a bucket and flips OWED ↔ BORDERLINE
`delay_proof.py:259-268` (_bucket), `:296-302` (threshold), `:357-360`, `:508-522` (records_agree)

Validators compare only the bucket, but `compute_ruling` branches on the exact `delay_min` at cut-offs inside a bucket:
- UK261, and EU flights from 2027-10-23: 180 → BORDERLINE, 181+ → OWED. Both fall in H3_4.
- EU: 120-164 → NOT_OWED, 165-179 → BORDERLINE. Both fall in H2_3.

PoC 4: the leader reports 180 and every validator sees 200 (their own ruling would be OWED). `run_validator()` returns **True**, and BORDERLINE is stored.

**Fix:** Make the bucket edges equal every decision edge. Add buckets `H2_165` (120-164), `B165_179`, `EQ180`, and `H181_239` (or bucket per rule set). Alternatively have validators run `compute_ruling` on their own record and require `outcome`, `amount` and `band` to be equal. The second is the more robust rule.

### P1-2. Leader-only fields are stored and shown as if agreed (coordinates, sources, analysts, reason, label), with no size cap
`delay_proof.py:508-532` (records_agree / record_shape_ok), `:646-647`

PoC 5: validators accept a leader record that has:
- each destination coordinate shifted 0.099° (allowed by the 0.1° tolerance at `:515`). The distance is recomputed from the leader's coordinates, so near 1,500/3,500 km the band, and the amount, can change. PoC 6: about 27 km of drift on FRA-MAD. A flight at 1,480 km can become "medium" (€400 instead of €250). The `near_distance_band_edge` flag is shown but the payout still happens.
- fabricated `sources` (a made-up "airline-ops-feed: loaded"), a fabricated `analysts` list (the count is not checked against the tier), `cause_label: "verified by the airline"`, a 200 kB `reason`, a 50 kB unknown top-level key, and HTML in `route.airline_name`.

All of this goes into `record_json`/`history_json` and is shown by the UI as part of what "the validators agreed" (app.js:190, 212-214).

**Fix:**
1. Validators should rebuild the stored record from **their own** `route` for the deterministic fields: compare origin/dest IATA exactly, then store canonical coordinates taken from a fixed airport table in the contract (IATA → lat/lon/country). Do not store floats that came from the leader.
2. Whitelist keys and cap lengths in `record_shape_ok`: `reason` ≤ 200, `cause_label` ≤ 60, `len(analysts) == TIER_ANALYSTS[tier]`, `sources` must equal the fixed list of names, and no extra keys.
3. In the UI, label `reason`, `cause_label`, the minutes and the per-analyst lines as "leader's notes (not checked by consensus)".

### P1-3. Payer funds are locked forever, and the pool has no controls
`delay_proof.py:162-172`, `:740-757`

There is no `withdraw_pool`/`close_pool`. A payer can't get back an unused balance, pause their own pool, or change the rate. Combined with P0-1, a payer's only defence is to never fund the pool. Anyone can `top_up_pool` into someone else's pool. That's harmless, but the money is also unrecoverable.

**Fix:** Add `withdraw_pool(pool_id, amount)` (payer only, limited to balance minus pending payable-but-unpaid claims), `set_pool_active`, and per-pool limits (see P0-1).

### P1-4. Owner and relayer are parties to every claim
`delay_proof.py:576-582`

The owner and relayer can `assess`, `appeal` and `finalize` any claim:
- assess before the claimant has added evidence
- appeal a claimant's OWED until it flips
- finalize at a convenient moment, including before the payer appeals

The default relayer is the deployer (`:550`). This is centralisation that the "independent validators decide" story does not mention.

**Fix:** Limit owner/relayer to `assess` on behalf of the claimant (meta-tx), and require the claimant's signature for that. Remove their `appeal` and `finalize` rights. Document the remaining powers on review.html.

### P1-5. The UI calls a ruling "Done … stored on-chain" and "agreed" at ACCEPTED, before GenLayer finality
`web/src/app.js:106`, `:309-312`; contrast `web/src/lib/finality.js:1-3`

`follow()` returns on `ACCEPTED`, which is still inside GenLayer's appeal/finality window. The UI then shows "Done: the ruling is stored on-chain" and the proof card says "AGREED BY INDEPENDENT VALIDATORS". `finalize`, `open_claim` and `withdraw` rows in LIVE_EVIDENCE.md are ACCEPTED, not FINALIZED. An ACCEPTED-but-later-overturned assessment would leave a shared proof card and letter that the chain no longer supports.

**Fix:** Show "accepted, finalising…" until `FINALIZED_SUCCESS`, and only then enable the proof card, letter and withdraw buttons. Put the tx finality state on the card.

### P1-6. Personal data can land on-chain, and the contract enforces none of the UI's privacy checks
`delay_proof.py:664` (note), `:230-247` (evidence URLs), `:461` (reason); `web/src/lib/ruling.js:155-157`

- The email and booking-reference checks exist only in the browser (ruling.js:155-156). Direct contract calls store anything up to 280 chars.
- Evidence URLs are stored publicly and fetched by every validator. A "manage booking" link (`…?pnr=ABC123&lastName=Smith`) leaks the PNR and surname, and may let validators load the passenger's booking page. That page text can then be echoed into `reason`/`cause_label` on-chain.
- The claimant address plus flight plus date is a permanent travel record. The burner key is reused for every claim in that browser, which links all of one person's trips. The consent box (index.html:71) mentions only "flight, date and note".

**Fix:** Mirror the email/PNR checks in `_clean_text`. Reject evidence URLs that have query strings or known booking paths (`manage`, `mytrips`, `pnr=`, `lastname=`, `booking`). Tell the analysts never to quote names or references, and cap and strip `reason` of anything matching PNR or email patterns. Expand the consent copy to cover the evidence links and the browser key linking trips. Offer "new key per claim".

### P1-7. Cost and DoS: unbounded external fetches per validator, and anyone can trigger them on any claim via P0-3
`delay_proof.py:604`, `:613`, `:629-639`

Each assess makes every validator fetch adsbdb, render FlightStats (with a 1.5 s wait), and render up to 6 evidence pages with a full browser, then run 1/3/5 LLM passes.
- Page size is truncated only *after* the render (`[:MAX_EVIDENCE_CHARS]`). Huge or slow pages, redirect chains, or pages that never settle burn validator time and can cause leader or validator timeouts.
- `URL_RE` (`:101`) accepts `https://127.0.0.1/…`, `https://localhost/…`, `https://10.0.0.5/…`, `https://169.254.169.254/…` and internal hostnames. Whether that reaches anything depends on the GenVM web module's egress policy, which this contract can't control. Validator operators should not have to trust it.

**Fix:** Reject IP literals, `localhost`, single-label hosts, and the RFC1918/link-local/metadata ranges in `URL_RE`. Prefer a domain allowlist (see P0-2). Use `web.get` with a size limit for evidence where JS isn't needed. Cap total evidence per claim (for example 3 across both sides at tier 1).

---

## P2

| # | Where | Issue | Fix |
|---|---|---|---|
| P2-1 | `delay_proof.py:125-134`, `:664`; README.md:34; LIVE_EVIDENCE.md:36 | The "prompt injection in note" guard protects nothing: the note is never put into the prompt (`_build_prompt` has no note argument). The docs present it as an injection defence, while the real injection surface (web text) has no filter. | Say plainly that the note is not shown to analysts, or drop the guard. Move the effort to P0-2. |
| P2-2 | `delay_proof.py:472-481` | Majority ties without UNKNOWN resolve alphabetically. On 2C/2E/1U, CONTROLLABLE wins, which favours the claimant. CANCELLED beats LANDED in a tie. | Any tie should give UNKNOWN (or "most cautious for the payer" on cause). |
| P2-3 | `delay_proof.py:655` | `paused` only blocks `open_claim`. `assess`, `appeal`, `finalize` and `withdraw_payout` keep running during an incident. | Add a pause check to every write except views (and perhaps `withdraw_pool`). |
| P2-4 | `delay_proof.py:654-676`, `:830-839` | Unlimited free claims and unbounded storage growth. `list_recent` shows the newest 50, so spam pushes real claims out of the UI's "Recent rulings". | Per-address rate limit or a small refundable bond. Paginate `list_recent` by cursor. |
| P2-5 | `delay_proof.py:629-631` | When the leader errors (LLM unparseable), validators always vote False, so real "can't parse" outcomes rotate leaders until UNDETERMINED instead of being agreed as an error. | Accept a leader error if the validator also errors with the same `[LLM_ERROR]` class. |
| P2-6 | `delay_proof.py:382-397` | adsbdb is a community route database. A wrong route (docs mention BA707) decides regime, distance and amount. The `seen_route` check only works when the pages show IATA codes. | Require `seen_route` to be present and equal to the route for any payable outcome. |
| P2-7 | `web/src/app.js:301-303` | The claim id is found by scanning `list_recent(20)` for "my open claim on this flight/date". With duplicates it picks the newest match. Under spam (>20 new claims) it fails. | Read the id from the `open_claim` tx return value. |
| P2-8 | `web/src/app.js:37-43` | The burner private key sits in `localStorage` in plaintext. Any XSS, malicious extension or compromised dependency can read it. Pool payouts go to that key, and clearing site data loses the claim (no finalize/withdraw). | Fine for testnet. Before real value: a wallet connector, or at least a key export/backup prompt and a non-extractable WebCrypto key. |
| P2-9 | `web/src/index.html` (no CSP), `:11-13` | No Content-Security-Policy. Google Fonts loads from a third party, which leaks visitor IPs and can't use SRI. | Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src https://studio.genlayer.com https://raw.githubusercontent.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'">`, or self-host the fonts. |
| P2-10 | `web/src/app.js:157,190,344,355`; `rig.js:33` | XSS review: every on-chain string goes through `esc()`/`X()`. Good. A few values are interpolated without escaping and are only safe because they are ints today: `claim.id`, `c.id`, `tr.id` (from localStorage), `claim.analysts`, and `a.delay_min` at `:149`, which is leader-controlled and safe only because `>= 0` rejects non-numeric strings. `rig.js:33` puts `e.message` into innerHTML. | Wrap these in `esc()` as well, or coerce them with `Number()`. |
| P2-11 | `web/package-lock.json` | `npm audit --omit=dev`: 7 moderate (minimatch ReDoS), all via `genlayer-js` → `eslint-plugin-import` declared as a *runtime* dependency. None of it is bundled into the browser build. `viem ^2.29` is caret-ranged in genlayer-js but pinned by the lockfile. | No action for the site. Report the packaging issue upstream. Keep `npm ci`. |
| P2-12 | `web/src/rig.js:29-30` | "MATCH: the deployed code is the published code" is shown even when the GitHub source fetch failed (`gh === null` counts as ok). In that case it only compared against a digest baked into the same site. | When `gh === null`, show "matches this site's pinned digest; source file unreachable". |
| P2-13 | `delay_proof.py:785` | `emit_transfer` comes after the state updates (correct ordering, and there is no re-entrancy in GenVM's message model). If the claimant is a contract address that rejects value, the claim is marked paid and the funds are stuck. | Acceptable on testnet. Optionally restrict withdraw to EOAs or add a `to` address. |

### Honesty (UI and docs say more than the contract proves)

- **"Pays automatically"**: index.html:69, :129, :147; README.md:11. Nothing is automatic. The claimant must `finalize` and then `withdraw_payout`. Say "the claimant can collect from the pool once the ruling is final".
- **Claim letter**: `ruling.js:117`, `:121`.
  - It asserts "I was a passenger". The contract never checked that. That's fine for the user to say, but the letter should not suggest the record proves it.
  - "Independent validators each fetched the public flight data and agreed on the record above" is wrong when an evidence page decided timing (P0-2), and at ACCEPTED (P1-5).
  - "I am entitled to €X" (`:111`) states a legal entitlement. Suggested wording: "the DelayProof ruling (information, not legal advice) found €X would be due under …".
- **"Nobody can edit them afterwards"** (review.html:24): appeals replace the ruling, and the owner/relayer can appeal any claim (P1-4).
- **"No airline gets a vote here"** (app.js:68), alongside "either side can add evidence": in fact *anyone* gets a vote via respondent evidence (P0-3).
- **"The ruling exists only because they agreed on the same flight status, delay band and cause"** (app.js:211): true for those three fields. It is not true for the minutes, distance, reason, cause label, sources or analyst list shown on the same panel (P1-2).

---

## What's solid

- The rules engine is deterministic and kept outside consensus. RULES_VERSION and the rule set are stored on every ruling, and the threshold and edge cases are tested (≥180 vs >180, the intra-EU medium cap, long-haul halving, BORDERLINE, Reg 2026/2202 date switch).
- LLM output is bounded: enum statuses and causes, clamped delay, label/reason truncation, `_bucket` recomputed and checked in `record_shape_ok`. A forged bucket is rejected (existing test).
- Validators re-fetch and re-run everything themselves and compare route identity, coordinates (with tolerance), countries, status, bucket, cause and seen airports. A route conflict produces INSUFFICIENT_DATA rather than a confident wrong amount.
- Payout ordering is correct: `paid = True` and the balance is debited before `emit_transfer`. Double withdraw, withdraw on a non-final claim, wrong regime, non-payable outcome and low balance are all refused and tested. The pool link is fixed at open (no re-linking), and `final` claims can't be appealed or have evidence added.
- Input hygiene: flight/date regexes, a 6-year/no-future window, NFKC plus invisible and control character stripping on text, https-only URLs without spaces or angle brackets, and a 300-char URL cap.
- On-chain strings are escaped consistently in the web app, both in DOM templates and in the proof-card SVG. `?claim=` is regex-checked. The burner key is labelled testnet-only. Sample mode never writes.
- The verify script is reproducible (pinned Python tools, exact genlayer-js/esbuild, lockfile with `npm ci`, RPC blocked in the offline tests). The on-chain code-digest check page is a good transparency primitive.
- The docs are already candid about the gate-vs-door-open gap, FlightStats' 3-day window, and the lack of any live OWED result.

## Suggested order of work

1. P0-1 (pool consent, uniqueness, challenge window)
2. P0-3 (respondent auth)
3. P0-2 (nonce fences and timing only from allowlisted sources)
4. P1-1 and P1-2 (validators compare the computed outcome; canonical record)
5. P1-5 (wait for finality in the UI)
6. P1-3 (payer withdraw)
7. P1-6 (privacy checks in the contract)
8. P1-7 (URL hardening)
9. Honesty copy
10. Everything in P2
