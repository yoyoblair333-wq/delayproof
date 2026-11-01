# Feasibility: can GenLayer validators read flight data themselves?

**Answer: yes, on studionet, for recent flights.** Recorded 2026-11-01 with throwaway
probe contracts deployed from the VERDICT relayer test key (never Blair's wallet).

## What was tested

`contracts/probe.py` asks the leader to fetch a URL inside `gl.vm.run_nondet_unsafe`
(`gl.nondet.web.get` or `gl.nondet.web.render(mode="text")`, GenVM v0.2.16) and stores
what it saw; validators re-fetch and agree only if they also succeeded or failed.
Runs: `docs/live/probe-run-1.json`, `probe-run-2.json`, `probe-run-3.json`.

| Source | Result from inside consensus | Used by DelayProof? |
|---|---|---|
| example.com | loaded (control) | no |
| adsbdb `api.adsbdb.com/v0/callsign/BAW117` | loaded: route LHR→JFK with airport countries and coordinates, airline and its country | **yes**, for route, coverage and distance |
| FlightStats flight tracker, with `?year=&month=&date=` | loaded: for BA117 on **30-Oct-2026** it showed scheduled 12:20 / actual 12:02 arrival, gate times, "Arrived, On time" | **yes**, the date-specific times source |
| FlightAware flight page by IATA number (`/live/flight/BA117`) | loaded, but resolved to an unrelated 2014 position-only flight | **no** (misleading; also its terms forbid scraping and use with event contracts) |
| airportia.com | blocked by bot protection | no |
| radarbox.com | HTTP 403 | no |
| OpenSky REST | connection timed out from the validators | no |

Probe contracts: `0xe69AD1b6C9E6b2430bD57076301DA6ca5CcdE33d` (deploy tx
`0xb900cc11281ca0b2e602458bbcedc1bf82da1a86842d844f5a9122df60237239`) and
`0x11639B6EAD6A312a91C538903b7322c0D3383990` (deploy tx
`0x5ba53ad19e988c1c1f0ce064f2826f67ce688a0a8977970edeb89a46b707b6c8`).

## A real bug the live chain caught

The first live assessment (`docs/live/run-0-float-bug.json`, contract
`0x552dda00B26AA5db68B386Ef094bD7c516472d3A`, assess tx
`0x539a13d0150e276b767fdeaa41b2fa9534bbd07e740a164a1734252b8ad92d04`) ended
UNDETERMINED: the leader's result contained airport coordinates as floats and GenVM
calldata has no float type (`not calldata encodable 40.6398: float`). The direct-mode
test harness does not encode leader results, so the tests missed it. Fixed by carrying
coordinates as integer micro-degrees, and a new test now encodes the leader result with
the SDK's own calldata encoder.

## Limits, stated plainly

1. **History window.** FlightStats' free tracker shows a few days around today. Older
   flights need evidence pages attached by the claimant or the airline, or a licensed
   historical feed.
2. **Licensing.** This is a testnet demo. FlightStats' terms for automated access were
   not verified; adsbdb route data may not be copied into other databases without
   permission; FlightAware forbids scraping and event-contract use (not used); OpenSky
   is non-profit research only (not reachable anyway). A production version needs a
   licensed feed (for example Cirium/FlightStats API or AeroDataBox) behind the same
   consensus design.
3. **Arrival time.** Public pages show gate/on-block arrival; the current legal test is
   door-open (Germanwings C-452/13). Rulings within 15 minutes under the threshold say
   BORDERLINE.
4. **Cause.** Public pages rarely state why a flight was late. With no stated cause the
   ruling is "owed unless the airline proves extraordinary circumstances", which is the
   legal default (burden on the airline).
5. **One times source.** Validators each fetch the source independently, which defends
   against a lying leader but not against the source itself being wrong. Evidence pages
   from both sides are the second channel; a licensed second feed is the real fix.
