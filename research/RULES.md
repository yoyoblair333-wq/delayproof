# DelayProof — Compensation Rules (EU261 / UK261 / US)

Research date: 2026-11-01. Status tags: **VERIFIED** = checked against a primary/official source in this pass; **CASE LAW** = well-established CJEU ruling (cite by CELEX); **UNVERIFIED** = secondary source only or not re-checked — confirm before relying on it in code that pays out money.

> **Big 2026 change.** Regulation (EU) **2026/2202** (16 Sep 2026) amends EU261. Published in the OJ 2 Oct 2026, in force 22 Oct 2026, **most substantive provisions apply from 23 Oct 2027**. Until then the original 2004 text + CJEU case law govern. The amounts and the 3-hour threshold are **unchanged**; the main code-relevant changes are listed in §9. Sources: [EUR-Lex ELI 2026/2202](https://eur-lex.europa.eu/eli/reg/2026/2202/oj), [Burges Salmon summary](https://www.burges-salmon.com/articles/102o4ut/evolution-delivered-what-regulation-eu-2026-2202-means-for-eu261-reform), [EP third-reading resolution P10_TA(2026)0238, 7 Jul 2026](https://data.europarl.europa.eu/distribution/doc/TA-10-2026-0238_en.pdf), [Joint text PE-CONS 39/2026](https://data.consilium.europa.eu/doc/document/PE-39-2026-REV-1/en/pdf).

---

## 1. Core table (machine-usable)

```yaml
# delayproof/rules v1 — valid for flights departing before 2027-10-23 (EU) / until further notice (UK)
delay_threshold_minutes: 180          # arrival delay must be >= 3h (Sturgeon/Nelson). Strictly: "3 hours or more"
distance_method: great_circle         # Art 7(4); connecting = origin -> final destination (Bossen C-559/16)
bands:
  - id: short
    max_km: 1500                      # "1500 km or less"
    eu261_eur: 250
    uk261_gbp: 220
    reduce50_if_arrival_delay_lt_min: 120   # Art 7(2)(a) — rerouting case
  - id: medium
    min_km_exclusive: 1500
    max_km: 3500                      # also ALL intra-EU flights > 1500 km (EU261 only)
    eu261_eur: 400
    uk261_gbp: 350
    reduce50_if_arrival_delay_lt_min: 180   # Art 7(2)(b)
  - id: long
    min_km_exclusive: 3500            # EU: non-intra-EU only
    eu261_eur: 600
    uk261_gbp: 520
    reduce50_if_arrival_delay_lt_min: 240   # Art 7(2)(c); for pure DELAYS on long-haul, 3h–<4h => 50% (EUR 300 / GBP 260)
special_rules:
  intra_eu_over_3500km: medium        # e.g. Lisbon–Helsinki, EU mainland–Canaries > 3500 km pays EUR 400, not 600
currency:
  eu261: EUR                          # passenger may ask for national currency (C-356/19 Delfly)
  uk261: GBP                          # fixed sums, not indexed
extraordinary_circumstances_burden: carrier   # carrier must prove + show all reasonable measures taken
```

| Band | Great-circle distance | EU261 (EUR) | UK261 (GBP) | 50% cut applies when arrival delay is under |
|---|---|---|---|---|
| Short | ≤ 1,500 km | 250 | 220 | 2 h |
| Medium | 1,500–3,500 km (EU: + all intra-EU > 1,500 km) | 400 | 350 | 3 h |
| Long | > 3,500 km (not intra-EU) | 600 | 520 | 4 h (3–4 h delay → 300 EUR / 260 GBP) |

Sources: [Reg. (EC) 261/2004, Art 7 — EUR-Lex CELEX 32004R0261](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32004R0261) (VERIFIED amounts — unchanged by 2026/2202 per [PE-CONS 39/2026 Art 7(1)](https://data.consilium.europa.eu/doc/document/PE-39-2026-REV-1/en/pdf)); [UK CAA — Delays](https://www.caa.co.uk/passengers/resolving-travel-problems/delays-and-cancellations/delays/) (VERIFIED: £220 / £350 / £260 for 3–4 h long-haul / £520 for 4 h+).

Notes for code:
- Compensation is **per passenger**, independent of ticket price.
- Compensation is assessed on the **final destination** arrival delay of the whole booking (Folkerts C-11/11, CASE LAW). Separate tickets (self-transfer) = separate flights ([CAA](https://www.caa.co.uk/passengers/resolving-travel-problems/delays-and-cancellations/delays/)).
- Boundary values: "1,500 km or less" → short; ">3,500 km" → long. Treat exactly 3,500 km as medium.

## 2. Distance computation

- Art 7(4): distances are determined "by the great circle route method" (VERIFIED, 261/2004 text).
- Connecting flights: use the great-circle distance **between the first departure airport and the final destination**, not the sum of legs (Bossen, **C-559/16**, 7 Sep 2017, CASE LAW — [CELEX 62016CJ0559](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62016CJ0559)). UK CAA uses the same rule for connections (VERIFIED).
- Implementation: haversine on airport lat/lon (WGS-84 mean radius 6,371.0 km). Haversine vs. Vincenty differ by < 0.5 %; flag results within ±10 km of 1,500 or 3,500 for manual review (UNVERIFIED — no official spec of Earth model; reasonable engineering choice).
- Reg 2026/2202 (from 23 Oct 2027): distance measured on the passenger's overall journey to final destination — effectively codifies Bossen (Burges Salmon summary; VERIFIED secondary).

## 3. Delay threshold — Sturgeon / Nelson

- The 2004 text only gives compensation for cancellation/denied boarding. The CJEU held passengers whose flight reaches the final destination **3 hours or more late** are entitled to the same Art 7 compensation:
  - **Sturgeon**, C-402/07 & C-432/07, 19 Nov 2009 — [CELEX 62007CJ0402](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62007CJ0402)
  - **Nelson / TUI**, C-581/10 & C-629/10, 23 Oct 2012 (Grand Chamber, confirmed Sturgeon) — [CELEX 62010CJ0581](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62010CJ0581)
- UK261: CAA states compensation is due when you arrive "more than three hours late" (VERIFIED). Use `>= 180 min` for EU (case law says "three hours or more") and treat exactly 180 min as an edge case to flag for UK.
- Reg 2026/2202 Art 6(4): codifies compensation for a "delay at arrival exceeding three hours" (PE-CONS 39/2026 text; VERIFIED). Note "exceeding" — switch to `> 180` for flights under the new rules.

## 4. What "arrival time" means

- **Current law: door opening.** Germanwings, **C-452/13**, 4 Sep 2014: arrival time = the moment **at least one aircraft door is opened** and passengers are permitted to leave — **not** touchdown or on-block ([CELEX 62013CJ0452](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62013CJ0452), CASE LAW).
- **From 23 Oct 2027 (EU): on-block.** Reg 2026/2202 adds Art 2(x): "time of arrival" = when the aircraft "reaches the arrival stand and its parking brakes are engaged (on-block time)" (VERIFIED in PE-CONS 39/2026 text; confirm against final OJ text).
- UK261 keeps Germanwings for now (pre-2021 CJEU case law is retained/assimilated in UK law; UNVERIFIED that no UK court has departed from it).
- **Oracle implication:** no public data feed reports door-open time. ADS-B gives touchdown/last-seen; airline/airport feeds give "in-block/gate arrival". Door-open is typically ~3–10 min after in-block (UNVERIFIED, operational estimate). Recommended rule: use gate/in-block arrival as a **lower bound** of door-open; if `gate_arrival_delay` is within 0–15 min under the threshold, mark `borderline` rather than `not_eligible`.

## 5. Cancellations (Art 5 + Art 7)

Compensation is **not** owed if the passenger was informed (VERIFIED, Art 5(1)(c) 261/2004; same structure on [CAA cancellations page](https://www.caa.co.uk/passengers/resolving-travel-problems/delays-and-cancellations/cancellations/)):

| Notice given | No compensation if re-routing offered that… |
|---|---|
| ≥ 14 days before departure | always — no compensation |
| 7–13 days | departs ≤ 2 h before original departure **and** arrives < 4 h after original arrival |
| < 7 days | departs ≤ 1 h before original departure **and** arrives < 2 h after original arrival |

- Otherwise full Art 7 amount, subject to the 50 % reduction (Art 7(2)) when the re-routed arrival is within 2 h / 3 h / 4 h by band.
- Carrier bears burden of proving when/whether the passenger was informed (Art 5(4)).
- Flight **brought forward** by more than about 1 h is treated as a cancellation (CJEU joined cases C-146/20 etc., 21 Dec 2021 — UNVERIFIED exact threshold).
- Extraordinary circumstances defence applies (Art 5(3)) — see §7.
- Refund option: delay ≥ 5 h → passenger may abandon trip and get refund (Art 6(1)(iii); CAA VERIFIED).

## 6. Which flights are covered

| Regime | Departing from | Arriving at | Carrier |
|---|---|---|---|
| EU261 | EU/EEA/Switzerland airport | anywhere | **any** carrier |
| EU261 | non-EU airport | EU/EEA/CH airport | **EU (Community) carrier only**, and only if no benefits/compensation received under third-country law (Art 3(1)(b)) |
| UK261 | UK airport | anywhere | any carrier |
| UK261 | non-UK airport | UK airport | UK **or EU** carrier |
| UK261 | EU airport | UK airport | UK carrier (EU carrier is already covered by EU261) |

Sources: Art 3, 261/2004 (VERIFIED); [CAA cancellations page](https://www.caa.co.uk/passengers/resolving-travel-problems/delays-and-cancellations/cancellations/) (VERIFIED: "flights departing a UK airport on any airline, flights arriving at a UK airport on an EU or UK airline, and flights arriving at an EU airport on a UK airline").

- **Operating** carrier is liable, not the marketing/codeshare carrier (Art 2(b), Art 3(5)).
- A single booking EU → non-EU connection → non-EU destination is covered for the whole journey, even on a non-EU carrier for the second leg (Wegener, **C-537/17**, 31 May 2018, CASE LAW).
- Free/staff tickets not available to the public are excluded (Art 3(3)).
- EEA (Iceland, Norway, Liechtenstein) and Switzerland apply EU261 via agreements; outermost regions (Canaries, Madeira, Azores, French overseas departments) are EU territory. Faroe Islands, Greenland are not (UNVERIFIED edge list).

## 7. Extraordinary circumstances (Art 5(3), recital 14)

Test (Wallentin-Hermann, **C-549/07**, 22 Dec 2008, [CELEX 62007CJ0549](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62007CJ0549)): the event must (1) **not be inherent** in the normal exercise of the carrier's activity **and** (2) be **beyond its actual control**; plus the carrier must show it took **all reasonable measures** to avoid the delay. Burden is on the carrier. Reg 2026/2202 Art 6c codifies this test with a non-exhaustive Annex list.

| Cause | Status | Authority |
|---|---|---|
| Technical defect found in maintenance / normal operation | **NOT** extraordinary | Wallentin-Hermann C-549/07 |
| Unexpected premature failure of a part (no maintenance fault) | **NOT** extraordinary | van der Lans **C-257/14**, 17 Sep 2015 |
| Hidden manufacturing defect revealed by manufacturer/authority, or sabotage/terrorism damage | Can be extraordinary | Wallentin-Hermann; van der Lans |
| "Wildcat" strike by own staff (mass sick-calls after restructuring announcement) | **NOT** extraordinary | Krüsemann **C-195/17** etc., 17 Apr 2018 |
| Union-called strike by carrier's own pilots/crew | **NOT** extraordinary (EU) | Airhelp v SAS **C-28/20**, 23 Mar 2021. UK: a 2020 county-court appeal (Ryanair 2018 strikes) went the other way — UK position UNVERIFIED |
| Strikes by ATC, airport or third-party staff | Generally extraordinary | Recital 14; CAA lists "airport or air traffic control staff strikes" (VERIFIED) |
| Bird strike | Extraordinary — but delay from carrier's own (unnecessary) follow-up checks may not be | Pešková **C-315/15**, 4 May 2017 |
| Volcanic ash closure of airspace | Extraordinary (care/assistance still owed) | McDonagh **C-12/11**, 31 Jan 2013 |
| Disruptive passenger | Extraordinary (also for the next flight of same aircraft) | LE v TAP **C-74/19**, 11 Jun 2020 |
| Fuel spilled on runway / foreign object (screw) damaging tyre | Extraordinary | Moens **C-159/18** (2019); Germanwings **C-501/17** (2019) |
| Airport fuel-supply system failure (airport-managed) | Extraordinary | C-308/21 KU v SATA (2022) — UNVERIFIED citation detail |
| Collision with airport stairs vehicle | **NOT** extraordinary | Siewert **C-394/14** (order, 2014) |
| Pilot/crew sickness | **NOT** extraordinary (UK) | Lipton v BA CityFlyer [2021] EWCA Civ 454 — UNVERIFIED (not re-checked) |
| Technical defect (UK) | **NOT** extraordinary | Jet2 v Huzar [2014] EWCA Civ 791 — UNVERIFIED (not re-checked) |
| Weather | **Case-by-case**: severe weather affecting the specific flight usually qualifies; weather at another airport or a forecastable condition the carrier could plan for may not. No clean CJEU line | CAA lists "extreme weather" (VERIFIED) |
| ATC restrictions / slot delays (non-strike) | Usually accepted as extraordinary when imposed by ATC on that flight; carriers must still show reasonable measures | recital 15 (ATC decisions); UNVERIFIED as a blanket rule |
| Knock-on delay from earlier rotation | Only if the earlier cause was itself extraordinary, and it must be shown for the same aircraft | C-74/19 |

CJEU links: [C-257/14](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62014CJ0257) · [C-195/17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62017CJ0195) · [C-28/20](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62020CJ0028) · [C-315/15](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62015CJ0315) · [C-12/11](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62011CJ0012) · [C-74/19](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62019CJ0074).

**Oracle implication:** a validator cannot reliably observe the *cause*. Suggested output enum: `eligible`, `not_eligible`, `eligible_unless_extraordinary` (default when delay ≥ threshold and cause unknown), `likely_extraordinary` (public evidence: ATC strike notice, airport closure, NOTAM, named storm). Treat airline-stated "technical issue" and "crew" causes as *not* extraordinary.

## 8. Time limits to claim (current, national law)

EU261 sets no limit; national limitation periods apply (Cuadrench Moré v KLM, **C-139/11**, 22 Nov 2012, CASE LAW). Which country's limit applies depends on the forum (departure/arrival country, carrier seat) — **flag as uncertain in any UI**.

| Country | Limit | Confidence |
|---|---|---|
| England & Wales | 6 years | VERIFIED-ish (CAA/claims firms; Limitation Act 1980) |
| Scotland | 5 years | UNVERIFIED (consistently reported) |
| Ireland | 6 years | UNVERIFIED |
| France | 5 years | UNVERIFIED |
| Spain | 5 years | UNVERIFIED |
| Germany | 3 years from end of the year of the flight | UNVERIFIED |
| Denmark | 3 years | UNVERIFIED |
| Italy | 2 years (some courts apply longer) | UNVERIFIED |
| Netherlands | 2 years (contested; some report 5) | UNVERIFIED |
| Belgium | 1 year | UNVERIFIED |
| Poland | 1 year | UNVERIFIED |

Source for table: claims-company summary ([Flight-Delayed.com](https://www.flight-delayed.com/en/blog/2020/10/20/the-time-limit-for-claiming-flight-delay-compensation)) — interested party, 2020; treat all as UNVERIFIED.

**From 23 Oct 2027 (EU):** passengers must submit the compensation request **within 9 months** of the flight's departure date; carrier must acknowledge immediately and **pay or justify refusal within 30 calendar days** (Art 7(9), PE-CONS 39/2026 — VERIFIED in joint text). A third party may be asked for proof of mandate.

## 9. Reg (EU) 2026/2202 — changes that affect code (apply from 23 Oct 2027)

1. Amounts unchanged: EUR 250 / 400 / 600 (VERIFIED).
2. Delay compensation codified at "exceeding three hours" (Art 6(4)); missed connections same threshold (Art 6b(3)).
3. Arrival = on-block / parking brake set (Art 2(x)) — replaces Germanwings door-open.
4. Long-haul 50 % reduction if arrival within 4 h (Art 7(2)); separate 50 %/25 % reductions for some early-departing re-routings (Art 7(3)) — UNVERIFIED detail.
5. 9-month claim window; 30-day carrier decision; payment by bank transfer unless passenger agrees otherwise; vouchers only with explicit consent (Art 7(7), Art 8a).
6. Annex list of extraordinary circumstances (non-exhaustive). Secondary sources say it includes natural disasters, war, severe weather, unruly passengers, strikes by airport/ATC/ground-handling staff, and excludes own-crew strikes and technical faults — UNVERIFIED until the Annex is read in the OJ text.
7. Rule set should be versioned by **scheduled departure date** (`< 2027-10-23` → v1 rules, `>= 2027-10-23` → v2 rules).

## 10. United States — no cash delay compensation (status as of Nov 2026)

- **No federal law requires cash compensation for delays or cancellations.** VERIFIED.
- **Dec 11, 2024 ANPRM** "Airline Passenger Rights" (89 FR 99760, docket DOT-OST-2024-0062, RIN 2105-AF20) floated mandatory cash compensation, rebooking and meals/lodging for controllable disruptions. Reported tiers were roughly $200–$300 for 3 h+ domestic up to $750+ for 9 h+ — **UNVERIFIED** (not read in the ANPRM text).
- **Withdrawn:** DOT signalled withdrawal in Sept 2025 and formally **withdrew the ANPRM effective 17 Nov 2025 (90 FR 51230)**. Reasons: FAA Reauthorization Act 2024 §512 gives no authority to mandate compensation; preference for competition; >$5 bn/yr industry cost estimate. VERIFIED ([govinfo 2025-20042](https://www.govinfo.gov/content/pkg/FR-2025-11-17/html/2025-20042.htm)). No replacement rulemaking found as of this date.
- **What remains:** the 2024 automatic-refund rule (14 CFR Part 260) — cash refund if the passenger declines travel after a cancellation or "significant change" (≥ 3 h domestic, ≥ 6 h international). DOT is not enforcing it for renumbered-but-rebooked flights until 7 Jul 2027 (enforcement discretion extended 7 Jul 2026 — [Eckert Seamans](https://www.eckertseamans.com/?p=26861)). Refunds ≠ compensation.
- Voluntary airline commitments (meals, hotels, some miles/vouchers) are shown on DOT's customer-service dashboard; not legally enforceable compensation ([TPG, Sep 2025](https://thepointsguy.com/news/trump-administration-withdraws-airline-compensation-rule)).
- **US flights are still covered by EU261/UK261** when departing the EU/UK (any carrier) or arriving there on an EU/UK carrier.

## 11. Decision pseudocode

```
regime = coverage(departure_airport, arrival_airport, operating_carrier)   # §6
if regime is None: return NOT_COVERED
if cancelled: apply notice table (§5) -> may short-circuit to NOT_ELIGIBLE
delay = actual_arrival(door-open proxy) - scheduled_arrival               # §4, final destination
if delay < 180min: return NOT_ELIGIBLE (unless cancellation/denied boarding)
km   = great_circle(first_departure, final_destination)                    # §2
band = band_for(km, intra_eu=both_airports_in_EU)                          # §1
amt  = table[band][regime]
if band == long and delay < 240min: amt *= 0.5                             # delay case
if cause in KNOWN_EXTRAORDINARY: return LIKELY_EXTRAORDINARY
return ELIGIBLE_UNLESS_EXTRAORDINARY(amt, currency)
```
