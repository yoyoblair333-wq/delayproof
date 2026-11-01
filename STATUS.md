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
