# DelayProof build status

## 2026-11-01 ~06:50 PT — hour 1
- **Feasibility: PROVEN on studionet.** Validators can fetch live web pages inside a
  non-deterministic block (`gl.nondet.web.get` / `gl.nondet.web.render`, GenVM v0.2.16).
  - Probe contract #1 `0xe69AD1b6C9E6b2430bD57076301DA6ca5CcdE33d` (deploy tx
    `0xb900cc11281ca0b2e602458bbcedc1bf82da1a86842d844f5a9122df60237239`): example.com,
    adsbdb route API, FlightAware and FlightStats pages all loaded; airportia and radarbox
    blocked (bot protection / 403); OpenSky timed out.
  - Probe contract #2 `0x11639B6EAD6A312a91C538903b7322c0D3383990` (deploy tx
    `0x5ba53ad19e988c1c1f0ce064f2826f67ce688a0a8977970edeb89a46b707b6c8`): FlightStats
    page for BA117 on a *past date* (30-Oct-2026) returns scheduled AND actual
    departure/arrival times — exactly the data a ruling needs.
- `contracts/delay_proof.py` written: claims, 1/3/5-analyst appeal ladder, evidence from
  both sides, deterministic EU261/UK261 ruling, payable testnet pool + withdraw.
  genvm-lint check + typecheck clean. 79 direct-mode tests pass (web + LLM mocked);
  mutation checks confirm the consensus and 3-hour threshold tests bite.
- Blockers: none yet. Rules values are placeholders (research/RULES-placeholder.md).

## 2026-11-01 ~07:50 PT — hour 2
- Research RULES.md adopted as the single rules table: rule set by departure date
  (EU261 + case law before 2027-10-23, Reg 2026/2202 after), UK261 separate, long-haul
  3–4 h 50% cut, intra-EU >3,500 km = medium, BORDERLINE within 15 min of the line,
  LIKELY_EXTRAORDINARY wording, near-band-edge flag. FlightAware dropped (ToS + it
  resolved IATA numbers to an unrelated old flight).
- **Live bug found and fixed:** first live assessment went UNDETERMINED because the
  leader result carried float coordinates (GenVM calldata has no float). Now integer
  micro-degrees; new test encodes the leader result with the SDK encoder.
  Failed run kept as docs/live/run-0-float-bug.json.
- Web app built (claim form, status rail, proof card, claim letter, appeal button,
  recent rulings, code-hash page, reviewer guide). verify.sh: VERIFY: PASS
  (91 contract tests, lint, typecheck, web build, 9 offline web tests incl. 375 px browser).
- Live evidence run #2 in progress on `0x76b28bDC23C86CFB9AE80b3f29643482Aed4BC45`.

## 2026-11-01 ~08:15 PT — hour 3
- **Live evidence complete** on `0x76b28bDC23C86CFB9AE80b3f29643482Aed4BC45` (stored code = source,
  sha256 `cb2d3eb7…9b87`). docs/LIVE_EVIDENCE.md has every tx:
  - BA117 30-Oct: validators fetched FlightStats, agreed LANDED on time → NOT_OWED_UNDER_3H; appeal to
    3 analysts agreed; finalized.
  - BA436 31-Oct with a claimant evidence page: agreed LANDED 40 min late ("departed 17 minutes late and
    arrived 40 minutes late") → NOT_OWED_UNDER_3H; linked to the testnet pool; withdraw correctly refused.
  - ZZ9999: agreed NOT_FOUND → FLIGHT_NOT_FOUND.
  - Guards reverted on-chain: future date, prompt injection in note, bad flight code, withdraw non-payable.
  - **Browser-signed** claim #4 (BA173 31-Oct) from the built page in headless Chromium: 33 s to an agreed
    ruling. Then airline-side evidence, appeal to 3, appeal to 5 analysts (5/5 agree), appeal past the top
    tier refused.
- Not shown live: an OWED payout (no 3h+ delayed flight found within FlightStats' free window during the
  run). The payout path is covered by direct-mode tests (pool lifecycle, double-pay, regime, balance).
- Fixed: mobile stamp overlap on the proof card; final rail step now ticks done.
