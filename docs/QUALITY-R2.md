# DelayProof quality review, round 2

Reviewer: independent reviewer who had not seen the build. Date: 2026-11-01. No repo code was edited; this file is the only one written.

**Scope.** Commit `9479cd4`, which is also what GitHub Pages serves: the `pages` and `verify` workflows are green on that SHA. The Pages URL itself is blocked by this sandbox's proxy (403), so I built `web/dist` locally and served it. I drove it with Playwright Chromium:
- 15 surfaces × 390/1280 × light/dark = 60 full-page screenshots plus 60 above-the-fold shots. The surfaces were the home page, the 7 `?sample=` states, live `?claim=1..5`, `review.html` and `rig.html`.
- Studionet RPC calls were answered through Node fetch with TLS verification on.
- Google Fonts were blocked, so the screenshots show fallback fonts.

Checks run:
- `pytest`: 161 pass.
- Web build plus `npm test`: 21/21 pass.
- axe-core (WCAG 2.2 AA plus best practice) on 6 pages × 2 themes.
- The 6 round-1 PoCs, unmodified.
- 10 new round-2 PoCs: `/tmp/claude-0/-home-claude/c3dd378d-e8cf-5884-b5cd-0c7a7db98c00/scratchpad/poc/test_poc_r2.py`, all 10 pass, so each one demonstrates a real issue.
- **One live, browser-signed claim (#6, BA283 2026-10-31)**, made through the real form against `0x6F3dedC8…1FBF` to time the full transaction lifecycle. It now shows in Recent rulings.

Bar: a premium consumer launch, judged the way a strict GenLayer steward would judge it.

---

## 1. Round-1 fixes: are they really fixed?

### Security (SECURITY-R1)

| R1 item | Verified? | Evidence |
|---|---|---|
| P0-1 pool drain | **Yes, with gaps** | Original PoC 1 now reverts at `finalize` ("challenge window open"). The duplicate guard, `approve_claim` and the per-flight cap work. **But** the uniqueness key and the cap can be bypassed by switching between the IATA and ICAO code for the same flight (new P1-3). The window also binds only the claimant (new P1-1). |
| P0-2 evidence writes the record | **Yes** | PoC 3 fails: the timing prompt has no evidence, so the mock never matches. Timing comes only from `STATUS_URLS`. On the live chain, SN3289 and BA707 now come back INSUFFICIENT_DATA. Small leftovers: P2-1 and P2-2. |
| P0-3 anyone fills respondent slots | **Yes** | PoC 2 reverts with "only the pool's payer or the airline's registered respondent…". |
| P1-1 leader picks the minute | **Yes** | PoC 4: `run_validator()` is now False, because `ruling_core` must be equal. |
| P1-2 unchecked leader fields | **Mostly** | PoC 5 is rejected (keys whitelisted, route must be identical, count and source names checked). Still leader-only and still shown as "agreed" with no label: `reason`, `cause_label`, the per-analyst lines and the `sources` ok flags (`app.js:172-173, 242`). |
| P1-3 locked payer funds | **Yes, but it over-corrected** | `withdraw_pool` and `set_pool_active` exist. They let the payer renege on claims it already approved (new P1-2). |
| P1-4 owner/relayer are parties | **No** | The relayer is gone. But the owner can `register_respondent(code, owner)` and then assess, appeal, add respondent evidence and finalize any claim on that airline. PoC `test_r2_a` does this. README's "Owner cannot assess, appeal, finalize" is therefore false in practice (new P0-1). |
| P1-5 "final" at ACCEPTED | **Yes** | `follow()` polls to FINALIZED (`app.js:111-125`). Live: `open_claim` was ACCEPTED in about 9 s and FINALIZED at about 37 s. The whole flow took 111 s. New problems in the rail itself are listed under P1-5 below. |
| P1-6 personal data on-chain | **Yes** | `_clean_note` refuses emails and booking references. Booking-path URLs are refused. Live guard tx `0xa161…7958`. |
| P1-7 unbounded fetches | **Partly** | IP literals, localhost and internal hosts are refused (live guard `0x971a…7b56`). The 1.5 MB check runs only *after* `web.get` has downloaded the whole body (`delay_proof.py:745-746`), so it bounds the render, not the bandwidth. |
| P2-2 ties | Yes | Ties go to UNKNOWN (`_majority`). |
| P2-3 pause | Yes, but now an owner weapon | See new P1-2. |
| P2-4 spam | Partly | `before_id` pagination exists, but the UI never uses it. Still no bond or rate limit. |
| P2-9 CSP | **Yes, nothing broken** | CSP on all three pages. `rig.html` allows `raw.githubusercontent.com` and shows a 3-way MATCH (screenshot). The lazy chunks load under `script-src 'self'`. No CSP console errors on any surface; the only error is the font block I set up myself. |
| P2-10 escaping | Yes | ids are passed through `Number()`/`esc()`. |
| P2-12 rig MATCH wording | Yes | — |

### Quality (QUALITY-R1)

| R1 item | Verified? | Evidence |
|---|---|---|
| #4 false facts on the proof card | **Partly, and regressed** | `BAND.NONE` no longer says "On time". But the live **BA707 card and ticket still show ZRH→LHR · 788 km · EU261**, while its own evidence and LIVE_EVIDENCE say Larnaca→Heathrow. v2 never sets `route_conflict` when the status page shows no airports. See new P1-4. |
| #5 wrong currency / €0 on non-rulings | Yes | The symbol comes from `regime`. No amount for NOT_FOUND or INSUFFICIENT_DATA. |
| #6 finality | Yes | See P1-5 above. |
| #7 Appeal for non-parties | Yes | `mine` gates every action (`app.js:161-168`). |
| #8 TOO_EARLY keeps the claim open | Yes | `test_r2_i`. But the appeal path now has a history-duplication bug (new P2-3). |
| #9 cancellation amount shown | Yes | `verdictBody` and the card say "up to / maximum". |
| #11 `near_4h_line` | **Contract only** | The flag is computed (`delay_proof.py:401-402`) but never shown anywhere in `web/src`. |
| #12 shared links carry the deciding tx | **Partly** | The "Copy link" button includes `&tx=`. But `renderResult`'s URL update is dead code (new P1-6). Recent rulings and My trips link `?claim=N` only, so most views show no votes and no tx. |
| #13 ruling first on shared links | Yes | It renders above the hero. However, the hero h1 then butts straight against "How this was decided" with no gap (screenshot claim-4-390). |
| #14 sample preview on load | Yes | — |
| #15 vertical rhythm | Mostly | The sections breathe. Leftovers are in the polish list. |
| #16 CTA above the fold / date | **Half** | The CTA is above the fold at 390×844. The date field still shows `mm/dd/yyyy`. At 1280 the flight input is 76 px tall and the date input 48 px, side by side. |
| #17 card dead gap / neutral cancelled | **Half** | "cancelled: no arrival" is neutral. The no-amount card still has a dead gap of roughly 290 SVG px between the explanation and the ticket (live claims #3 and #4, `card.js:76`). |
| #18 a11y | **Yes** | axe: 0 violations on 12 page/theme runs. No tap target under 24 px. `#result` is not `aria-live`. **But** the review table still clips the "Proof" column at 390 px. |
| #19 dist clean / lazy signer | **Half** | No `.map` files, and dist is cleaned. genlayer-js is split out, but `loadRecent()` and `loadContract()` import it on every visit (`app.js:22-24, 445-446`), so readers still download about 560 KB raw of viem and genlayer. Reads only need `fetch` (as `rig.js` already does). |
| #20 review proof links | **No** | `review.html` has 2 `<a>` in total. The "Proof" cells are plain text. |
| Copy: "pays automatically", "independent", "permanent", "nobody can edit", "either side", "up to 35 %" | Yes | grep finds none. |
| R1 §4 #14/#15: "3 hours or more" lede; intra-EU >3,500 km rule | No | Unchanged (`index.html` lede; bands paragraph). |
| Sample `review` band | No | MAD–CDG at 1,063 km is still labelled "medium" (`samples.js`). |

## 2. Round-1 PoCs re-run on contract v2

`test_poc.py`, unmodified: PoC 1 to 5 now **fail to exploit**. PoC 6 is math only and is moot, because route equality is now exact.

| PoC | v2 result |
|---|---|
| 1 | reverts at the challenge window |
| 2 | reverts: respondent authentication |
| 3 | no LLM mock matched, so the spoofed block never reaches the timing prompt |
| 4 | validator returns False |
| 5 | validator returns False |

---

## 3. New issues

### P0

**P0-1. The owner can still act on any claim, through `register_respondent`.**
- Where: `delay_proof.py:1019-1027`, `:700-707`, `:891-892`.
- What happens: the owner registers its own address (or a friend's) as the respondent for "BA". It then has every respondent power on all BA claims: assess, appeal, add "airline" evidence and finalize at any time. There is no check, no delay, no event, and the respondent can be silently overwritten mid-claim.
- Proof: PoC `test_r2_a`. The owner adds an "ATC strike" page, appeals OWED_UNLESS → LIKELY_EXTRAORDINARY, finalizes at once, and the claimant's appeal then reverts.
- Why P0: the README roles table and the contract docstring (`:39-41`) both say the owner "cannot assess, appeal, finalize". That is the central trust claim, and it is false.
- Fix:
  - Make respondent registration two-step: the owner proposes, the respondent address accepts.
  - Add a delay before it takes effect (for example 24 h) and forbid `respondent == owner`.
  - Freeze the respondent per claim at `open_claim`, stored on the `Claim`.
  - Or drop respondent finalize entirely (see P1-1).
  - Correct the README and docstring either way.

### P1

**P1-1. The challenge window protects only the payer and airline, not the passenger.**
- Where: `delay_proof.py:883-900`, and `:859` (assess).
- What happens: the payer or registered respondent can `finalize` instantly. A tier-1 NOT_OWED (one analyst) can be locked before the claimant can appeal (PoC `test_r2_b`). The respondent can also `assess` an open claim before the claimant has added evidence, then finalize it (PoC `test_r2_h`). The appeal ladder, the "you can appeal" promise, is one-sided.
- Fix:
  - Let respondents finalize early **only if the ruling is payable** (an "accept"). Otherwise they wait out the same window.
  - Make `assess` claimant-only.
  - The README calls this "accept a ruling at any time", which hides the problem.

**P1-2. Payer approval is not a commitment, and pause plus expiry voids owed payouts.**
- Where: `delay_proof.py:934-939`, `:977-979`, `:996-1010`.
- What happens:
  - After approving and after the ruling is final and owed, the payer can call `set_pool_active(False)` and the claimant's withdraw reverts "pool is closed" (PoC `test_r2_d`).
  - Expiry voids approved, final, owed claims, and `withdraw_pool` returns their money to the payer.
  - The owner can pause, which blocks `withdraw_payout`, until the pool expires. The payer then reclaims everything, which works while paused (PoC `test_r2_e`).
- Fix:
  - On approval, reserve `amount_max` in an `encumbered` balance.
  - `set_pool_active(False)` should only stop *new* links and approvals.
  - Let approved claims withdraw after expiry for a grace period.
  - `withdraw_pool` takes only the unencumbered balance.
  - Exempt `withdraw_payout` of approved, final claims from pause, or extend expiry by the paused time.

**P1-3. IATA/ICAO aliases bypass "one claim per flight", the per-flight cap and the airline respondent.**
- Where: `delay_proof.py:817`, `:956`, `:692-695`.
- What happens:
  - `BA117` and `BAW117` are different keys for the same flight. The same claimant opens both, and a pool with `max_per_flight=1` approves both (PoC `test_r2_c`).
  - A respondent registered for `BA` is not a party to the `BAW117` claim, so a claimant can dodge the airline by choosing the other code.
  - Suffixes (`BA117A`) are a third alias.
- Fix: canonicalise the airline (an IATA↔ICAO table in the contract, or key on adsbdb's `airline.iata` from the agreed route), and key the cap, uniqueness and respondent on the canonical code.

**P1-4. Unconfirmed adsbdb routes are shown as fact (the live BA707 ruling).**
- Where: `delay_proof.py:355-357, 374-377`; `web/src/app.js:204-213`; `lib/card.js`.
- What happens: when the status page shows no airports (`seen_route == "-"`), no conflict can be detected. The ruling still carries `regime`, `distance_km` and the route from adsbdb, and the UI and card print "ZRH → LHR · 788 km · EU261". The claim's own evidence says LCA–LHR. This is the same class of false fact R1 #4 flagged, on the shareable artefact.
- Fix:
  - In the contract, require `seen_route` to equal the route before using regime, distance or band for anything payable (this is R1 P2-6, still open). For non-decisions, blank them in `base`.
  - In the UI, label an unconfirmed route as "route from database, not confirmed by the status page" or hide it.

**P1-5. The status rail misreports the transaction lifecycle.**
- Where: `web/src/app.js:82-101, 303-308, 336-338`. Observed live on claim #6.
- What happens:
  - (a) During `open_claim`, the COMMITTING/REVEALING callback calls `rail("agree", …)`. Steps 2 and 3 tick as done ("Validators pulling the flight record ✓", "Comparing what each validator found…") before any flight record exists, then the rail jumps **back** to step 1 at ACCEPTED (log at 6 s → 11 s).
  - (b) `rail("done", note)` never shows its note, because no `li` matches index 4. "Final: the ruling is stored on-chain (still open to appeal)" never appears, and the finished rail keeps "Final. Reading the ruling back…" and step 1's stale "accepted; waiting for it to be final".
  - (c) On done, all 5 validator nodes turn green (`styles.css:47`) while the tally right below says "agree 3, idle 2".
- Fix: guard the onState transitions by `step`; write the done note into the last step; colour the vnodes from `voteDots`.

**P1-6. The deciding tx is never written into the URL.**
- Where: `web/src/app.js:171` and `:265`.
- What happens: `const history = …join("")` shadows `window.history` inside `renderResult`. `history.replaceState` is therefore `undefined` and the `&tx=` URL update never runs. Live, the URL after the flow is `?claim=6`. Reload, bookmark, My trips and Recent rulings all lose the votes and the tx. The README and review page claim "shared links carry the deciding transaction … (also on shared links)".
- Fix:
  - Rename the local to `historyHtml`.
  - Better: store the deciding tx hash per tier on-chain, so `?claim=N` alone can show its proof.

**P1-7. The copy still sends users to a path the contract now closes.**
- Where: `index.html:53`; `app.js:141`.
- What happens:
  - The date hint says "Older flight? Add a public evidence link under 'More options'".
  - The review verdict body says "Adding a public link … and appealing to a bigger panel often settles it". It is shown on live claims #3 and #4, whose problem is that FlightStats is out of range.
  - In v2, evidence can never set timing, so neither helps (PoC `test_r2_j`: a 5-year-old claim with evidence is always INSUFFICIENT_DATA). `review.html` itself admits this. Users burn appeals for nothing.
- Fix:
  - Say "Works for flights in the last ~3 days".
  - Cap `MAX_CLAIM_AGE_DAYS` to the status window, or label older claims "can't be decided yet".
  - Offer an appeal only when the reason is the cause, not the timing.

**P1-8. The demo payout path is a dead end for real users, and it expires in 2 days.**
- Where: `index.html:70`; live `get_pool(1)`: `expires_at 2026-11-03T16:50:17Z`, `challenge_minutes 10`.
- What happens:
  - Nothing approves claims (there's no payer UI and no bot), so "Collect test payout" is unreachable for any visitor.
  - After 3 Nov, ticking the box makes `open_claim` revert "pool is not accepting claims" and the whole check fails.
  - The site says the challenge window is "an hour" (`index.html:117`); the live contract's is 10 minutes.
- Fix:
  - Read the pool's `active`/`expires_at` and hide the box when it's closed.
  - Build a minimal payer view (approve or decline), or state plainly that a human approves.
  - Show `challenge_minutes` from `get_config`.
  - Redeploy with 60, as the docs promise.

**P1-9. A repeat check of the same flight is a dead end.**
- Where: `app.js:313-345`.
- What happens: opening the same flight and date again reverts "you already have a claim…" and the rail shows a red failure with no route to the existing claim. This is common after a reload, or after TOO_EARLY on another device or tab.
- Fix: before signing, scan `list_recent` (or a new `get_claim_id(flight, date, claimant)` view) and jump to the existing claim.

### P2

| # | Where | Issue | Fix |
|---|---|---|---|
| P2-1 | `delay_proof.py:450-454` | `defang` strips `<<`/`>>`, but fences are now `[[…]]`. Only the exact nonce is removed, so a nonce split by a zero-width character survives `render(text)`. Low impact (cause pass only, authenticated respondents). The live claim #5 reason echoes `SOURCE-bbec1e1e…`. | Strip `[[`/`]]` and invisible characters from page text; tell the analysts not to quote fence tokens. |
| P2-2 | `delay_proof.py:599` | `timing_source` is a constant, even when FlightStats failed. It carries no information. | Record the source name actually used, or drop the field. |
| P2-3 | `delay_proof.py:877-881`, `:787-790` | An appeal that yields TOO_EARLY appends a history entry but keeps the tier. It is repeatable without limit (PoC `test_r2_g`: 4 appeals, tier 1, 4 duplicate history rows). | Append history only when `_apply` stores a new ruling. |
| P2-4 | `delay_proof.py:941-961` | Approval is allowed before the ruling and is irrevocable. Approving a claim that ends NOT_OWED burns the per-flight cap and blocks a genuine claim (PoC `test_r2_f`). | Count only approved **and** payable-final claims, or add `revoke_approval` while the claim isn't final. |
| P2-5 | `delay_proof.py:629-631` | R1 P2-5 is still open: a leader `[LLM_ERROR]` is never agreed, so it rotates to UNDETERMINED. | As in R1. |
| P2-6 | `lib/card.js:50` | The halved and appeal-upheld cards say "You're owed" even when the outcome is OWED_UNLESS. The page says "Owed, unless…". | Add an `unless` variant for those states. |
| P2-7 | `web/src/lib/*` | `near_4h_line` and `near_distance_band_edge` are never shown. | One line in the verdict body and on the card: "close to 4 h; door-open time may make it £520". |
| P2-8 | `app.js:22-24, 445` | genlayer-js and viem load on every visit for read calls. | Use plain `fetch` JSON-RPC for `gen_call`, as in `rig.js`; `import()` only on write. |
| P2-9 | `app.js:328` | The claim id is still found by scanning `list_recent(20)` (R1 P2-7). | Read the return value from the tx receipt. |
| P2-10 | `review.html` | No links in "Proof"; the table clips at 390 px. | Stack as cards on mobile; link the tx hashes and files. |

---

## 4. Polish: top 15

1. **Sticky rail after done.** The checking board stays above the result at full height. Collapse it to a one-line "Final · tx 0x8d5a…" once the result renders.
2. **Field heights.** At 1280 the flight input is 76 px and the date input 48 px, side by side. Match them.
3. **Date format.** Still `mm/dd/yyyy` for EU/UK users. Add a "DD Mon YYYY" echo under the field, or use a custom control.
4. **Board flight text wraps** to 2–3 lines at 390 ("BA283 · 2026-10- / 31"). Use a smaller mono size, or `white-space: nowrap` with ellipsis.
5. **Proof card dead gap** on no-amount states. Move the ticket up to `y ≈ 520` when there is no amount.
6. **Seal clipping.** The circular "AGREED BY VALIDATORS" seal crops to "Y VALIDATORS" at 1280 dark (owed sample).
7. **Shared view spacing.** On `?claim=`, the hero h1 sits flush under the "How this was decided" card. Add a section divider or a "Check your own flight" heading.
8. **Wrong colour for small delays.** The orange "late" chip and the "Agreed delay" text are used for a 17-minute delay (claim #6). Use a neutral style for anything under 2 h.
9. **"Agreed delay" wraps** ("3 to 4 hours / late") in a mono 4-column grid at 1280. Shorten it to "3–4 h" or give the column more width.
10. **Owed verdict body** is about 80 words on mobile. Lead with one sentence and move the "within 15 minutes" mechanics into "How this was decided".
11. **Not-owed cancellations** say "You may still be owed meals or care". For cancellations, mention the refund or rerouting right.
12. **"open to appeal" on samples and on not-yours claims**, where no Appeal button exists. Say "the passenger can appeal until …".
13. **Challenge-window hint** shows only a time of day. Show the date and a live countdown, and re-render when it ends so "Make final" appears without a reload.
14. **"How this was decided"** should label `reason`, `cause_label`, the analyst lines and the source flags as "leader's notes, not checked by consensus" (R1 P1-2 part 3).
15. **Recent rulings** should link `?claim=N&tx=…` (once the tx is stored) and paginate with `before_id`.

## 5. Scorecard vs R1

| Area | R1 | R2 | Why |
|---|---|---|---|
| Visual polish | 7 | 7.5 | Ruling-first shared view, sample preview, rhythm better. Field mismatch, card gap, seal clip and the stale rail remain. |
| Clarity | 6 | 6.5 | Cancellation maximum and neutral cancelled are clear. Dead-end "add a link and appeal" advice and the stale rail remain. |
| Trust / honesty | 6 | 6.5 | Overclaims are gone and the letter is careful. The live BA707 route shown as fact, the false owner-powers claim and "an hour" vs 10 min remain. |
| Accessibility | 7 | 8.5 | axe 0 everywhere, targets ≥24 px, focus moved. The review table still clips. |
| Performance | 7 | 7 | app.js is small, but the signer stack still loads for read-only visits. |
| Copy | 7 | 7.5 | Calmer and accurate, with a few stale lines. |
| Steward: real trust problem | 7 | 7 | Unchanged and well argued. |
| Steward: live/authoritative data | 5 | 6.5 | Timing is now only from the status page, which is correct. In practice that means a ~3-day window, and the UI still invites older claims. |
| Steward: docs complete/accurate | 7 | 7 | LIVE_EVIDENCE is excellent and candid. The README roles table and the "shared links carry the tx" claim are inaccurate. |
| Steward: full tx lifecycle | 6 | 7 | It really waits to FINALIZED (live: 111 s end to end). The rail regresses visually, and the tx is lost from the URL. |
| Steward: continued use | 5 | 5.5 | Consent, cap and expiry exist, but approval isn't binding, the pause + expiry rug exists, there's no payer UI, and the pool dies 3 Nov. |
| Hype penalty | moderate | low | Overclaims are gone. |
| Code/docs quality | 7 | 7.5 | 161 tests including the PoC regressions. Shadowed-`history` bug and dead `timing_source`. |

## 6. Inaccurate claims (site, README, LIVE_EVIDENCE, review.html)

1. **README roles table and `delay_proof.py:39-41`: "Owner … cannot assess, appeal, finalize".** False via `register_respondent` (P0-1).
2. **README step 5: "the payer or registered respondent can accept a ruling at any time".** They can *finalize any* ruling, including one against the claimant, which cuts off the claimant's appeal (P1-1).
3. **README step 1 "One claim per flight, date and claimant" and step 6 "at most `max_per_flight` per flight and date".** Bypassable with IATA/ICAO aliases (P1-3).
4. **README "Web app" and review.html "shows … the deciding tx (also on shared links)".** Only when the "Copy link" button was used. The page's own URL update is dead (P1-6), and Recent rulings/My trips links carry no tx.
5. **index.html:117 "challenge window (an hour)".** The live contract is 10 minutes (`get_config`).
6. **index.html:53 "Older flight? Add a public evidence link" and app.js:141 "appealing … often settles it".** Contradicted by v2's timing isolation and by review.html's own "What this does not prove".
7. **Live claim #4 (BA707) page and proof card: "ZRH → LHR · 788 km · EU261".** LIVE_EVIDENCE says the page describes Larnaca→Heathrow. The v1-era note "route database disagrees" isn't detected in v2 (no `route_conflict`), yet the label is kept.
8. **README "fence-like text is stripped from pages".** It strips `<<`/`>>`; the fences are `[[…]]` (P2-1).
9. **review.html "Frontend handles the full tx lifecycle … follows each transaction through ACCEPTED to FINALIZED".** True. But the rail shows steps 2 and 3 done during `open_claim` (P1-5).
10. **Carried over from R1:**
    - The lede's "3 hours or more" is not true for UK261, which is *more than* 3 h.
    - The bands paragraph omits the intra-EU >3,500 km = €400 rule.
    - The `review` sample labels 1,063 km "medium".
11. **LIVE_EVIDENCE.** Accurate as far as I could check against the chain:
    - Claims #1–5 and pool 1 match `get_claim` and `get_pool`.
    - Code digest `567cfec1…` matches in `rig.html`.
    - The doc already discloses the 10-minute window, but the site doesn't.

---

## 7. Fix status (branch `polish-r2`, contract v3, not deployed)

Everything below was run locally on this branch. **Nothing was deployed.** The site still points at the v2 contract `0x6F3dedC8…1FBF`, so the contract fixes are not live yet. The web fixes work against v2: they were checked offline with mocked RPC, and the fetch read path was checked with one live read-only call to v2 (`get_config`, `get_claim(4)`, `get_pool(1)`, `list_recent`).

**Merge only together with a v3 deploy.** `rig.html` compares the deployed code with `contracts/delay_proof.py` on `main`. If this branch is merged without redeploying (and without updating `CONTRACT_ADDRESS` and `CONTRACT_CODE_DIGEST` in `web/src/config.js`), the page will correctly report MISMATCH. The site copy also describes v3 rules, such as "nobody can finalize inside the window", and those are not true of v2.

Tests:
- Contract: 189 pass. That is the 161 existing test cases, of which 12 test functions were updated where they encoded the old behaviour (listed below), plus 28 new test cases in `tests/direct/test_security_r2.py`.
- `genvm-lint check` and `typecheck` pass.
- Web: 30/30 pass. That is the 21 existing tests, including the axe scan at 375 px in light and dark, plus 9 new ones.

### Fixed

| Item | Fix | Test |
|---|---|---|
| **P0-1** owner acts via `register_respondent` | `register_respondent` refuses the owner's address. `create_pool` refuses the owner. `_is_payer`/`_is_respondent` treat the *current* owner as a non-party, which also covers `transfer_ownership` to an existing payer or respondent. | `TestOwnerNeverAParty` (4) |
| **P1-1** window binds only the claimant | Nobody (claimant, payer, respondent) can `finalize` before the window ends, except at tier 3, where no appeal is left. `assess` is claimant-only. | `TestWindowBindsEveryone` (5) |
| **P1-2** approval not binding; pause + expiry rug | `approve_claim` needs an assessed (or final), unpaid claim whose current ruling this pool pays. It reserves `RULES[regime][band] × rate` in `Pool.encumbered`. `withdraw_payout` no longer checks `active` or expiry. `withdraw_pool` returns only `balance − encumbered`. `set_pool_active(False)` only stops new links and approvals. | `TestBindingApproval` (6) |
| **P2-4** approving a not-owed claim burns the cap | Folded into P1-2: such a claim can't be approved. If an approved claim ends final with a ruling the pool doesn't pay, the reservation and the per-flight slot are released. | same |
| **P1-3** IATA/ICAO aliases | `ICAO_TO_IATA` table (64 airlines). `_flight_key` = canonical code + number without the suffix letter, used for uniqueness, the per-flight cap and respondent lookup (registration is stored canonically). New `get_claim_id(flight, date, claimant)` view. | `TestCanonicalFlight` (4) |
| **P1-4** unconfirmed route shown as fact | Contract: if the status page doesn't show both airports, the ruling is INSUFFICIENT_DATA (`route_unconfirmed`). Every non-decision (NOT_FOUND, TOO_EARLY, UNKNOWN, conflict, unconfirmed, no route) has blank regime, rule set and band, and distance −1. An unknown route is now INSUFFICIENT_DATA, not NOT_COVERED. Web: `routeStatus()`; route, distance, rule and "€0" are shown only for a confirmed route, which handles live v2 claim #4 (BA707) without a redeploy. | `TestConfirmedRoute` (5); web "R2 P1-4" |
| Leader-only fields shown as agreed | "How this was decided" puts `reason`, `cause_label`, the per-analyst lines and the source flags under "Leader's notes, not checked by consensus". `cause_label` was removed from the ticket stub, `describe()` and the claim letter. | web "R2: leader-only…", shared-link test |
| **P1-5** rail regressions | `open_claim` only moves step 1, and the rail never moves backwards inside one write. The "done" note is written into step 4 and the stale "waiting for it to be final" is cleared. The 5 board nodes are coloured from the real votes. | covered indirectly (sample board); the live write flow was **not** re-run |
| **P1-6** `&tx=` never written | The local is renamed to `historyHtml`. My trips links keep the tx. | web "shared link keeps &tx=" |
| **P1-7** dead-end copy | Date hint: "Works for flights in roughly the last 3 days…". The INSUFFICIENT_DATA verdict says evidence and appeals can't fill in missing timing. The evidence form says evidence informs only the cause. | grep |
| **P1-8** expired demo pool | Reads `get_pool(1)`. When the pool is closed or expired the box is disabled with a note, and a check never sends `pool_id=1` to a closed pool. When open, the note says a person approves claims by hand. The window length comes from `get_config` (`[data-window]`, contract panel); it is no longer "an hour". | web "R2 P1-8", shared-link test (10 minutes) |
| **P1-9** repeat check dead end | Before signing, and on an "already have a claim" revert, the app finds this browser's claim (`get_claim_id`, falling back to scanning `list_recent(50)` on v2) and opens it. | web "R2 P1-9" |
| **P2-1** fences | `defang` strips invisible characters first, then the nonce, `[[`/`]]` and `<<`/`>>`. | `test_double_square_brackets…` |
| **P2-3** TOO_EARLY appeal history | A history row is added only when a new ruling is stored. | `test_r2_g…` |
| **P2-6** halved/appeal "You're owed" for OWED_UNLESS | Card variants say "unless". | web "R2 P2-6" |
| **P2-7** near-line flags | One line in the owed verdict body. | not separately tested |
| **P2-8** genlayer-js on every visit | `web/src/lib/rpc.js` does `gen_call` and `eth_getTransactionByHash` over `fetch`, byte-identical to genlayer-js. genlayer-js and viem load only to sign and follow a write. | web "R2 P2-8" (byte equality), shared-link test (no lazy chunk requested) |
| **P2-10** review table | The Proof cells link to the repo files. The table stacks as cards at ≤600 px. | screenshot only |
| Docs §6 items 1–7 | README: deployment-status box, roles table, finalize/window, pools/reservation, canonical keys, fences, shared-link wording. review.html: tx wording, window wording, pool wording. LIVE_EVIDENCE (regenerated): BA707 route marked "not confirmed" and the evidence's Larnaca → Heathrow stated; the stale "route database disagrees" step label is annotated; every claim's route line now says whether the status page confirmed it; the demo pool expiry is noted. | — |
| R1 carry-overs | Lede "3 hours or more under EU rules, more than 3 hours under UK rules". Intra-EU >3,500 km €400 sentence. The `review` sample band is "short". | — |
| Polish 2, 3, 4, 5, 7, 8, 12, 13, 14 | Equal 60 px flight/date inputs at ≥601 px. "Selected: 30 Oct 2026" date echo. Board flight text no longer wraps. No-amount card block moved down by 120 px. A divider above the hero on shared views. Neutral chip under 2 h. "The parties can still appeal" when the claim isn't yours. Window end shown as date + time with a live countdown that re-renders. Leader's notes labelled. | — |

Existing tests changed because they asserted the old, now-fixed behaviour:
- `test_payer_can_finalize_early` became `test_payer_cannot_finalize_early`.
- `test_no_payout_after_expiry` became `test_approved_claim_still_paid_after_expiry`.
- `test_owed_only_pool`, `test_not_payable_outcome`, `test_regime_mismatch` and `test_balance_too_low` now expect the refusal at `approve_claim`.
- `test_registered_respondent_is_a_party` now waits out the window.
- `test_owner_cannot_act_on_claims` has a new revert message.
- `test_junk_iata_ignored` and `test_route_lookup_failure_degrades` now expect INSUFFICIENT_DATA instead of OWED/NOT_COVERED.
- `test_icao_flightstats_url` and `test_flightstats_url_is_date_specific` pass the airports explicitly.
- `conftest.analyst()` now reports the mocked flight's airports by default, as a real status page does.

The original `test_poc_r2.py` was run unmodified against v3: 8 of 10 now fail to exploit, and r2_i/r2_j are behaviour notes, not exploits. Part of that is because its `analyst()` sends no airports, which v3 rejects on its own, so the ported tests in `test_security_r2.py`, which do send airports, are the real regression evidence.

### Deferred

- **P0-1, stronger form.** The reviewer also suggested two-step propose/accept, a delay before a new respondent takes effect, and freezing the respondent per claim at `open_claim`. None of these is done. The owner can still register (or silently replace) a friend's address. The README says so.
- **P1-6, on-chain tx hash.** The deciding tx is not stored on-chain, so `?claim=N` alone (Recent rulings) still shows no votes.
- **P1-7, contract side.** `MAX_CLAIM_AGE_DAYS` is still 6 years, so old flights are accepted and end INSUFFICIENT_DATA. The Appeal button is still offered on INSUFFICIENT_DATA rulings; only the copy says it won't help with timing.
- **P1-8.** There is no payer UI. The site says a person approves by hand. The 60-minute owner deploy has not been done.
- **P2-2.** `timing_source` is still a constant, because `record_shape_ok` pins it.
- **P2-5.** A leader `[LLM_ERROR]` still rotates to UNDETERMINED.
- **P2-9.** After `open_claim` the claim id comes from `get_claim_id` on v3 and from a `list_recent` scan on v2, not from the receipt.
- **R1 P1-7.** The size check still runs after the download.
- **Reservations.** A reserved amount whose claimant never withdraws stays locked in the pool. This is a testnet trade-off, chosen so that a pause or expiry can never void an owed claim.
- **Polish 1, 6, 9, 10, 11, 15.** Collapsing rail, seal clipping, "Agreed delay" wrap, shorter owed body, cancellation-specific not-owed copy, Recent rulings pagination.
- **Live verification.** The P1-5 rail and the end-to-end signed flow were not re-run on studionet (no deploy, no writes).
