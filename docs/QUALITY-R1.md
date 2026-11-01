# DelayProof quality review, round 1


> **Status after polish round 1:** fixed: #4 proof-card false facts (no "On time" for diverted/unknown, rejected routes hidden, currency per regime, FLIGHT_NOT_FOUND ≠ "Not owed", cancellation maximum shown), #6 finality (polls to FINALIZED), #12 shared links carry the deciding tx and show its votes, #13 ruling first on shared/sample links, #14 sample preview renders on load, #16 check button above the fold at 375×667, #17 neutral "cancelled: no arrival", #18 24 px tap targets and focus moved to the ruling instead of an aria-live dump, #19 dist cleaned, no source maps, genlayer-js loaded on demand (app.js 428 KB → 44 KB), CSP on every page; Appeal/Finalize hidden for non-parties, final claims and inside the challenge window. Copy: no "pays automatically", "permanent", "nobody can edit", "no airline gets a vote" or "either side can appeal"; "validators hosted by GenLayer"; the claim letter names the deciding sources and says "may be owed". Tests: `web/test/offline.test.mjs` (21).
Reviewer: independent quality lead who did not see the build. Date: 2026-11-01.
Scope: built `web/dist` served locally and driven with Playwright (Chromium) at 390 px and 1280 px, light and dark, every
state (`?sample=owed|halved|review|not-owed|appeal-upheld|paid|checking`), live `?claim=1..5` read from the deployed
studionet contract `0xAC6b99E9…a31f` (RPC reached through the sandbox proxy), `review.html` and `rig.html`. I also read
README.md, docs/LIVE_EVIDENCE.md, docs/FEASIBILITY.md, contracts/delay_proof.py and research/RULES.md, ran the 104
direct-mode contract tests (all pass) and ran axe-core on 6 pages × 2 themes.

Limits of this review: the GitHub Pages URL could not be fetched from this sandbox (proxy 403), so everything is from a
local build of the same source. Google Fonts were also blocked here, so screenshots use fallback fonts; the live site
will render Schibsted Grotesk / Inter / IBM Plex Mono. No code was edited.

The bar: a polished consumer launch (top-tier fintech/travel app) and a strict GenLayer portal steward. On the second,
the trust model is the main concern, not the visuals.

---

## 1. The first 10 seconds on a phone (390 × 844)

- **What works.** A thin amber "Test mode" bar, the logo, then a big, confident headline: "Your flight was late. Find
  out if you're owed **€250 to €600**." The highlighted money range catches the eye right away. The flight-number and
  date fields are above the fold. It looks calm and credible, closer to a travel app than a crypto dApp. That's the
  right call.
- **What hurts.**
  - The "Check my flight" button sits at about 1,090 px, below the fold. The lede paragraph is about 75 words, which is
    too long for a phone.
  - The date field shows US `mm/dd/yyyy` on a product for EU and UK passengers.
  - The hero illustration is dropped on mobile, so the first screen is all text.
- **On a shared link (`?claim=N`) it's worse.** The person you shared the ruling with first sees the whole hero and form
  again. The ruling starts about 1,150 px down (verified on claims #1 to #5). The most viral surface of the product
  hides its payload.
- **Feel.** Trustworthy and tidy, but not yet "cinematic". There is no motion or result on the first screen, and the
  "What a ruling looks like" section right under the form is **empty** (bug, see fix #14).

## 2. Scorecard (1–10)

| Area | Score | Why |
|---|---|---|
| Visual polish | **7** | The design system is strong: verdict panel, boarding-pass ticket, flip-tile amount, proof card, coherent dark mode. It's let down by the empty sample section, colliding headings ("What a ruling looks like" runs straight into "What happens after a ruling"), misaligned container widths at 1280 px, a large dead gap in the proof card when there is no amount, and a summary label that runs together ("More options note, evidence links, automatic payout"). |
| Clarity | **6** | The happy-path copy is clear. The live non-happy states are confusing: claim #3 is final, yet it tells you appealing "often settles it". The €400 possibly owed for SN3289 isn't shown anywhere except inside the letter. ZZ9999 (flight not found) is labelled "Not owed". |
| Trust / honesty | **6** | Disclaimers are excellent and everywhere: test mode, not legal advice, airlines not bound, samples labelled. But the UI shows **false facts on real live claims**. The BA707 card says "On time (agreed)" for a diverted flight that was 3+ h late, and shows the ZRH→LHR route the contract itself rejected. The LOG31 card says "€0 … under UK 261". Payout copy is overstated ("pays by itself"). |
| Accessibility | **7** | axe: 0 violations (WCAG 2.1 AA + best practice), light and dark. There's a screen-reader amount, reduced motion is handled, and there's a skip link. Gaps: nav links, the consent checkbox and the pool checkbox are under 24 px tall (WCAG 2.2 2.5.8). `#result` is `aria-live` and gets its whole innerHTML replaced, so a screen reader reads the entire result in one go. The review table scrolls sideways at 390 px and hides the "Proof" column. |
| Performance | **7** | Measured locally, unthrottled: LCP 110–320 ms on every page (the LCP is the h1 text). The home page moves about 690 KB uncompressed in 16–19 requests (python http.server doesn't gzip). Gzipped, the critical JS is about 140 KB: app.js 88 KB, chunk 35 KB, chunk 14 KB. The whole genlayer-js/viem signer loads eagerly, even for someone who only reads. Google Fonts CSS is render-blocking. Source maps (3.2 MB) and stale chunks from earlier builds ship in `dist/` (the build never cleans it). review.html is 55 KB, rig.html 115 KB. No horizontal scroll at 390 px anywhere. |
| Copy | **7** | Warm, plain, honest voice ("Flagged, not guessed", "We know that stings"). A few lines overclaim (section 4), and the lede is too long for mobile. |
| Steward: real trust problem | **7** | Real and well argued. The airline holds the data and decides; claim firms take 25–50 %. |
| Steward: live/authoritative data | **5** | adsbdb plus FlightStats are fetched inside consensus. That's real, but it's scraped, unlicensed, and only covers a ±3-day window. Outside that window the deciding "data" is whatever page the claimant links (SN3289 was decided entirely by an AirHelp page, and AirHelp is an interested claim firm). The route source keys on callsign, not flight number, which is a known mismatch (BA707). The docs are candid about all of this. |
| Steward: docs complete/accurate | **7** | LIVE_EVIDENCE is exemplary: every tx, every vote, the expected reverts, and a real bug the live chain caught. README, FEASIBILITY and the review page contain several inaccurate claims (section 4). |
| Steward: frontend ↔ contract, full tx lifecycle | **6** | All six writes are wired and the ruling is read back from `get_claim`. But `follow()` stops at ACCEPTED and the rail says "Ruling final … Done", which overstates finality. Shared-link views have no tx hash or votes. The Appeal button is shown to non-parties, so it is guaranteed to revert. |
| Steward: differentiated, credible continued use | **5** | Appeal ladder, two-sided evidence and BORDERLINE handling are genuinely good ideas. The payout pool, the main "continued use" hook, can be drained as written (no passenger proof, no duplicate guard, anyone can link any pool, the claimant can finalize instantly). No live OWED yet. |
| Steward: hype penalty | moderate | "It can pay by itself", "No letter, no chasing", "permanent", "independent validators" on a hosted testnet. |
| Code/docs quality | **7** | The contract is clean, bounded and well commented. Pure helpers are unit-tested, the 104 tests pass, and there's a verify script and a code-hash page. Some dead and misindented code in `app.js submit()`. The sample `review` data mislabels a 1,063 km route as band "medium". |

---

## 3. The 20 most valuable fixes (ranked)

Size: S = under 1 h, M = half a day, L = a day or more. Tag: **[C]** correctness / trust, **[P]** polish.

| # | Tag | File | What | Why | Size |
|---|---|---|---|---|---|
| 1 | C | `contracts/delay_proof.py` `open_claim`, `withdraw_payout` | Close the pool-drain path. Today anyone can open N claims for the same flight and date and link them to **any** pool without the payer's consent. There's no proof of being a passenger. Each claim then withdraws once. Add at least: the payer must allowlist or approve each claim (or pre-register claimant addresses); one payable claim per (pool, flight, date, claimant); a per-(pool, flight, date) cap. Add tests for duplicates. | The card-perk/insurer story is the "continued use" pitch, and a steward will try this first. The tests cover double-pay on one claim, not N claims. | L |
| 2 | C | `contracts/delay_proof.py` `finalize` | Add an appeal window. The claimant can `assess` → `finalize` → `withdraw_payout` back to back, so the payer never gets to appeal. Require N minutes (or blocks) after the last assessment, or the payer's consent when a pool is linked. | Without it the appeal ladder doesn't protect the side that pays. | M |
| 3 | C | `contracts/delay_proof.py` `add_evidence`, `_is_party` | "Respondent" evidence can be added by **anyone**, which allows griefing (filling the 3 slots) and fake "airline" pages. Meanwhile the airline can't assess or appeal at all. Either register a respondent address per pool or claim, or rename the slot "third-party evidence" and fix the docs. | The "two-sided" claim is currently untrue in both directions. | M |
| 4 | C | `web/src/lib/card.js` (`BAND.NONE = "On time"`), `web/src/app.js` ticket | The live BA707 card says **"On time (agreed)"** for a DIVERTED, 3+ h-late flight. The ticket shows ZRH→LHR, 788 km, EU261: exactly the route the contract rejected as `route_conflict`. Map NONE to "Delay unknown". On `route_conflict`, show both routes (database vs pages) and hide distance and rule. | A false fact on a shareable proof card is the worst possible bug for a "proof" product. | S |
| 5 | C | `web/src/lib/card.js` amount fallback | Not-owed cards show `€0` whenever currency is empty, which is always the case for amount 0. So LOG31 (UK261) reads "€0 per passenger · under UK 261", and ZZ9999 (flight not found) gets "Not owed this time €0". Derive the symbol from `regime`, and don't show any amount for NOT_FOUND, INSUFFICIENT_DATA or NOT_COVERED. | Wrong currency, and it implies an entitlement decision where none was made. | S |
| 6 | C | `web/src/app.js` `follow()`, `send()`, rail | Don't call ACCEPTED "Ruling final … Done: stored on-chain". Show "Accepted, appeal window open" and keep polling to FINALIZED, or label it honestly. Also show the tx hash with a copy button or explorer link on every rail step. | Steward criterion: full tx lifecycle. GenLayer's ACCEPTED is not final. | M |
| 7 | C | `web/src/app.js` `canAppeal`, `verdictBody` | Only show Appeal when the viewer is a party (claimant, or pool payer via `get_pool`). Don't tell final claims (#3, #4) to "add a link and appeal". | Right now a viewer of #5 sees an Appeal button that is guaranteed to revert with "only a party can appeal". | S |
| 8 | C | `contracts/delay_proof.py` `assess` / `_apply` | TOO_EARLY (and arguably NOT_FOUND from a source outage) should leave the claim `open` so it can be re-assessed. Today it burns tier 1, and the user can only "appeal" a flight that simply hadn't landed yet. | Same-day claims are a natural use. | M |
| 9 | C | `web/src/app.js` result, `web/src/lib/card.js` | For POSSIBLY_OWED_CANCELLATION, show the amount ("up to €400, depending on notice") on the page and the card. Stop saying "the validators flagged it": the validators agreed, and the deterministic rules made it conditional. | SN3289's €400 is only visible inside the claim letter. | S |
| 10 | C | `contracts/delay_proof.py` `_build_prompt` / `aggregate`; `web/src/lib/ruling.js` `claimLetter` | When no flight-status page loaded usable data and status or delay came only from claimant evidence, add a flag (`evidence_only`). Show it in the UI. Change the letter sentence "validators each fetched the public flight data" for those cases. Lens 1 already says evidence should "only explain the cause", but SN3289 shows evidence deciding the status. | Otherwise a claimant can decide their own case with any page they control. | M |
| 11 | C | `contracts/delay_proof.py` `compute_ruling` | Add a `near_4h_line` flag (or BORDERLINE) for long-haul gate delays of 225–239 min. Door-open can push it past 4 h, which changes €300 to €600 (£260 to £520). Same reasoning as the existing 3 h BORDERLINE. | Consistency with the stated door-open caveat. | S |
| 12 | C | `web/src/app.js` `?claim=` view | Shared links show no validator votes and no deciding tx. Store the deciding tx hash per tier on-chain (cheap) or look it up, then render votes plus a "verify this tx" recipe on every view. | A proof link that can't point at its proof is weak for a steward and for an airline. | M |
| 13 | P | `web/src/index.html`, `app.js` boot | When `?claim=` or `?sample=` is present, render the result **first** and collapse the hero and form (or move the result above them). | The shared-link recipient currently scrolls about 1,150 px to see the ruling. | S |
| 14 | P | `web/src/app.js` lines ~289–292 | The `#samplepreview` render is inside `submit()` (misindented dead block), so "What a ruling looks like" is an empty heading on load. Move it to boot. | It's the first thing under the form on every visit. | S |
| 15 | P | `web/src/styles.css` | Add vertical rhythm between sections: `.samplecard`, `.after`, `.wallet`, `.recent` and `.contract` headings butt against the previous block. Align `.after` and `.chatbot` to the wide container at 1280 (they're offset now). | It's the main thing separating this from a premium launch. | S |
| 16 | P | `web/src/index.html` hero | Cut the lede to one sentence on mobile. Get the CTA above the fold at 844 px. Show a day/month/year date hint or a custom date control. Add a separator in the "More options" summary. Make the result appear with a short reveal, not a jump. | The first 10 seconds. | M |
| 17 | P | `web/src/lib/card.js` | Reflow the proof card when there is no amount: no 250 px dead gap in review/not-owed. Turn "no arrival delay recorded" (shown in alarm red) into neutral "Cancelled: no arrival" for cancellations. | The card is the shareable artefact. | S |
| 18 | P | `web/src/design/components.css` | Make tap targets at least 24 px (ideally 44 px): nav links, `.dp-check` checkboxes. Make `#result` not `aria-live` and move focus to `#v-title` instead. Turn the review table into stacked cards at 390 px. | Accessibility above axe's floor. | S |
| 19 | P | `web/scripts/build.mjs`, `index.html` | `rm -rf dist` before building. Don't publish `.map` files. Load genlayer-js through `import()` only when a write starts (readers need just an RPC `fetch`). Self-host or preload fonts with `font-display: swap`. | Cuts about 120 KB gz of JS from first load and removes a third-party render-blocking request. | M |
| 20 | P | `web/src/review.html` | Make every "Proof" cell a link (repo file, LIVE_EVIDENCE anchor, tx RPC query). Add a "what a steward can try in 2 min" list: open a claim, see the votes, run rig.html. Fix the inaccurate lines in section 4. | Reviewer conversion. | S |

Also worth doing but outside the top 20:
- The sample `review` data marks MAD-CDG (1,063 km) as band "medium"; it should be "short".
- The paid sample shows "€400 paid", but the pool pays `400 × units_per_currency` test wei (0.4 GEN). Say so.
- The UTC-only date check rejects a "today" flight for users east of UTC early in their day.

---

## 4. Claims that are inaccurate, overstated or contradict the evidence

### Contradicted by the contract or the evidence

1. **README line 9: "Either side can appeal to a bigger panel."** `appeal` requires `_is_party`, which means claimant,
   owner, relayer or pool payer. The airline cannot appeal. The same point applies to "either side can add public
   evidence": respondent evidence is unauthenticated, so it is "anyone", not "the airline". The same wording appears on
   the home page ("Either side can add public evidence first").
2. **"Pays out automatically" / "pay automatically" / "It can pay by itself" / "When someone has opted in, it pays by
   itself. No letter, no chasing."** These appear in README line 11, the home page "How it works" step 3, the chatbot
   section, the pool checkbox and the spot illustration. In fact the claimant must call `finalize` **and**
   `withdraw_payout`, and the payer is a third-party test pool, not the airline. No live OWED ruling or payout has ever
   happened (LIVE_EVIDENCE says so).
3. **BA707 proof card: "On time (agreed)", ZRH→LHR, 788 km, EU261.** LIVE_EVIDENCE records DIVERTED, a 3+ h delay from a
   technical fault, a route conflict (pages say LCA-LHR), and INSUFFICIENT_DATA.
4. **LOG31 proof card: "€0 per passenger · under UK 261".** The contract ruled LIKELY_EXTRAORDINARY with amount 0 and no
   currency. The euro sign is wrong for UK261.
5. **ZZ9999 shown as "Not owed"** (Recent rulings chip and proof card "Not owed this time €0"). LIVE_EVIDENCE:
   FLIGHT_NOT_FOUND, which is no decision on entitlement.
6. **Claim letter: "Independent validators each fetched the public flight data and agreed on the record above."** For
   SN3289 the flight-status source was out of range. The record came from a claimant-attached AirHelp page.
7. **Rail: "Ruling final" / "Done: the ruling is stored on-chain"** is shown at ACCEPTED, before FINALIZED. LIVE_EVIDENCE
   itself distinguishes ACCEPTED and FINALIZED.
8. **Claims #3 and #4 (final) tell the user that "appealing to a bigger panel often settles it".** The contract refuses
   appeals on final claims.

### Overstated

9. **README lines 27–28: "the record is permanent".** It lives on studionet, a test network whose state can be reset.
   The letter also cites this testnet record to an airline.
10. **"Independent validators"** appears in the meta description, lede, cards, letter and review page. On studionet the
    validators are GenLayer-hosted, and most tallies show 3 voting plus 2 idle. "Several GenLayer validators" is
    accurate; "independent" isn't demonstrated.
11. **review.html: "claim firms can take up to 35% (AirHelp's published fee)".** README and MARKET.md say 25–50 %
    (AirHelp 35 % plus 15 % for legal action), so "up to 35 %" contradicts the project's own research.
12. **review.html: "nobody can edit them afterwards".** An appeal replaces the ruling (history is kept), the owner can
    pause the contract, and the testnet can reset. Reword to "every change is on the public record".
13. **"Uses live or authoritative data" (review.html).** Only for about ±3 days. Beyond that, claimant-linked pages from
    interested parties decide. FEASIBILITY admits this; the review table should too.

### Minor inaccuracies against RULES.md

14. **Hero lede: "3 hours or more".** True for EU261 before 2027-10-23. UK261 and the contract use *more than* 3 h
    (`DELAY_THRESHOLD_MIN + 1`).
15. **Bands section: "€400 / £350 up to 3,500 km, and €600 / £520 beyond that".** It omits the intra-EU rule (EU flights
    over 3,500 km pay €400), which appears only in the graphic's small print.
16. **FEASIBILITY.md tested `callsign/BAW117`, but the contract queries adsbdb with the ticketed code (`BA117`).** The
    doc should say which one production uses. This mismatch is the root of the BA707 route conflict.

### Possible evidence issue (please verify)

17. **LIVE_EVIDENCE claim #4 BA707 is dated 2026-10-19**, but the analysts' own reason says it diverted "shortly after
    midnight on 19 Oct" after missing Heathrow's night curfew. That suggests the **scheduled departure was 18 Oct**. The
    evidence URL slug is dated 21-10-2026. If so, the analysts accepted a page about a different date despite the
    "double-check the date" lens. Worth confirming before it is cited as a showcase.

### Amounts checked against RULES.md: consistent

- #1 LHR-JFK: 5,540 km, long, UK261.
- #2 KOI-ABZ: 200 km, short.
- #3 BRU-TLV: 3,251 km, medium, EU261, €400. Correct.
- Samples: LIS-AMS 1,858 km €400; LHR-JFK 3h25 £260 (halved); FCO-DUB 1,885 km medium. All correct.
- Exception: the `review` sample's band label (see above).
