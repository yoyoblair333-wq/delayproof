# DelayProof — Market Research

Research date: 2026-11-01. Tags: **VERIFIED** = checked in a primary or first-party source this pass; **UNVERIFIED** = secondary/interested-party source or not re-checked. Many headline numbers in this market come from claim companies (AirHelp, APRA members) — treat as marketing unless noted.

---

## 1. The problem in numbers

| Metric | Value | Source / confidence |
|---|---|---|
| Share of eligible EU261 passengers who claimed | **8 % (2011) → 38 % (2018)** | European Commission, *Study on the current level of protection of air passenger rights in the EU* (2020), as summarised by [Lexgo/Lexing](https://www.lexgo.be/en/news-and-articles/6633-regulation-261-2004-on-air-passenger-rights-the-need-for-reform). Commission-funded study; best neutral figure found. Secondary summary — UNVERIFIED against the PDF |
| Claim rate by disruption type (2018) | < 20 % for cancellations; ~60 % for delays | same |
| Airline cost of EU261 compensation per passenger carried | €1.8 (2011) → €4.4 (2018), CAGR +13.6 % | same |
| Share of claims arriving via claim agencies | 10–50 % per airline, typically 30–40 % | same |
| "Two-thirds of passengers don't claim" | 67 % unclaimed | APRA president (claim-company trade body), 2018 — interested party, UNVERIFIED ([AirHelp press](https://www.airhelp.co.uk/press/apra-welcomes-the-european-court-of-auditors-special-report-on-eu-passengers-rights/)) |
| "85 % of EU citizens don't claim, > €5 bn/yr left unclaimed" | — | Claim-company study reported by [Profit.ro](https://profit.ro/insider/auto-transporturi/studiu-85-dintre-cetatenii-ue-pierd-anual-peste-5-miliarde-de-euro-pentru-ca-nu-cer-despagubiri-pentru-zboruri-anulate-17954048) — UNVERIFIED, marketing figure |
| US travellers eligible for EU261 (via EU flights) | 370k (2017) → 407k (2018); < 25 % of those affected filed | AirHelp data, [TPG Apr 2019](https://thepointsguy.com/news/airhelp-us-airlines-wrongfully-rejecting-25-of-eu-261-compensation-claims/) — interested party |
| European Court of Auditors (Special Report, 8 Nov 2018) | "rights are comprehensive, but passengers still need to fight for them"; cites low awareness + weak enforcement | ECA, via AirHelp press page — VERIFIED title/date only |
| US: cost estimate of a compensation mandate | > $5 bn/yr (industry estimate cited by DOT) | [90 FR 51230, 17 Nov 2025](https://www.govinfo.gov/content/pkg/FR-2025-11-17/html/2025-20042.htm) — VERIFIED |

**Takeaway:** even in the best neutral data, well over half of eligible cancellation passengers and a large share of delay passengers never claim, and those who use agencies lose 25–35 %+ of the payout. A trust-minimised "is this flight eligible?" verdict is the missing primitive.

## 2. Claim-company fees

| Company | Standard fee | Legal / court surcharge | Source / confidence |
|---|---|---|---|
| AirHelp | **35 % incl. VAT** of compensation | **+15 % incl. VAT** if legal action needed (AirHelp says ~3 % of cases) — total up to 50 % | [AirHelp price list, v PL2.26, updated 11 Aug 2026](https://www.airhelp.com/en-int/our-fees) — VERIFIED |
| Flightright | "up to 30 % + VAT" (~36 % incl. 20 % VAT) | none separate per AirHelp's description | [AirHelp comparison blog](https://www.airhelp.com/en-int/blog/airhelp-vs-flightright-best-flight-compensation-service-in-the-eu/) — competitor source, UNVERIFIED (flightright.com price page failed to load) |
| ClaimCompass | ~25 % + VAT; ~+25 % legal (commonly reported) | | UNVERIFIED (site redirected; not confirmed) |
| Skycop, Compensair, etc. | ~25–35 % typical | often + legal fee | UNVERIFIED |
| Small-claims / direct | 0 % | court fee | — |

Rule of thumb for UI copy: **"Claim agencies keep 25–50 % of your payout."**

## 3. Typical airline rejection tactics

1. **Blanket "extraordinary circumstances"** — citing weather/ATC/"operational" or technical issues even when case law says technical defects are not extraordinary (Wallentin-Hermann, van der Lans). MSE/Sunday Mirror poll: airlines cited technical faults or "exceptional circumstances" to discourage claims ([Travel Weekly](https://travelweekly.co.uk/articles/45202/airlines-accused-of-stalling-on-compensation-claims); undated, ~2013 — old).
2. **Outright rejection** — same poll: Ryanair rejected 48 %, Virgin Atlantic 36 % of claims (UNVERIFIED, old).
3. **Stalling / leaving claims pending** — Jet2 63 %, Thomson 61 % pending in that poll (UNVERIFIED, old).
4. **"Wrongful rejection" rate** — AirHelp says Delta 32 %, United 23 %, American 22 % of valid claims rejected (2016–2018, AirHelp data; interested party).
5. **Offering vouchers / miles instead of cash** — under EU261 payment must be cash/bank transfer unless the passenger agrees in writing (Art 7(3) 2004 text; tightened by Reg 2026/2202 Art 8a). VERIFIED rule; prevalence UNVERIFIED.
6. **Refusing to deal with claim agencies / demanding proof of mandate** — Reg 2026/2202 now lets carriers require evidence of a valid mandate (VERIFIED, joint text Art 7(9)).
7. **Disputing arrival time** — using touchdown vs door-open, or citing their own block times (practical; UNVERIFIED prevalence).
8. **Running out the clock** — exploiting short national limitation periods (Belgium/Poland 1 year) (UNVERIFIED).
9. **Strike framing** — UK: Ryanair won a 2020 county-court appeal treating 2018 union strikes as extraordinary ([Ryanair release, 12 Feb 2020](https://corporate.ryanair.com/news/ryanair-welcomes-uk-court-ruling-confirming/?market=ie)); in the EU, CJEU C-28/20 (2021) later held own-staff strikes are **not** extraordinary.

## 4. Potential "payers" beyond airlines

### Credit-card trip-delay reimbursement (US, expense reimbursement — **not** cash compensation; secondary to airline)

| Card | Trigger | Max | Limits |
|---|---|---|---|
| Chase Sapphire Reserve | 6 h or overnight | $500 / ticket | part of fare paid on card |
| Chase Sapphire Preferred | 12 h or overnight | $500 / ticket | |
| Capital One Venture X | 6 h or overnight | $500 / ticket | cardholder + family |
| Amex Platinum / Delta Reserve / Marriott Brilliant | 6 h | $500 / trip | 2 claims per card per 12 months; round trip required |
| World of Hyatt, Marriott Boundless/Bold, United Club | 12 h or overnight | $500 / ticket | |

Claims typically within 60 days (Chase/Amex) or 30 days (Capital One). Source: [The Points Guy, updated 27 May 2026](https://thepointsguy.com/credit-cards/cards-with-trip-delay-reimbursement) — VERIFIED secondary; confirm in each benefit guide. **Integration angle:** DelayProof's on-chain delay attestation could serve as the "proof of delay" document these claims require.

### Parametric flight-delay insurance

| Product | What happened | Source / confidence |
|---|---|---|
| **AXA fizzy** (Ethereum, launched Sep 2017; initially US–France flights, then broader) | Automatic payout on delay via smart contract. **Discontinued end-2019** — "did not reach its commercial targets", not enough market interest, wrong distribution channels. AXA kept interest in the tech. | [Artificial Lawyer, 8 Oct 2020](https://www.artificiallawyer.com/2020/10/08/axa-scraps-fizzy-insurance-smart-contract-but-still-interested-in-the-tech/) — VERIFIED. Payout threshold (widely reported as 2 h) UNVERIFIED |
| **Etherisc FlightDelay** | Parametric cover for delays > 45 min and cancellations; Chainlink oracles for flight data; payouts via Gnosis Chain; risk pool staked by DIP-token holders; 80+ airlines (relaunch ~Jan 2022). Current (2026) status **UNVERIFIED**. | [Blockworks](https://blockworks.com/news/etherisc-insures-against-flight-delays-via-crypto-rails); [Insurance Edge, 24 Jan 2022](https://insurance-edge.net/2022/01/24/etherisc-launches-blockchain-backed-flight-delay-cover/) |
| Blink Parametric (Collinson), Chubb, travel-insurer add-ons, bank-card lounge passes on delay | Off-chain parametric delay products, often B2B2C through banks/airlines | UNVERIFIED (not researched in depth) |

**Lesson from fizzy:** the tech worked; distribution and demand failed. DelayProof should piggyback on an existing *legal* entitlement (EU261/UK261) rather than sell new cover, so it does not need to create demand.

## 5. Flight-data sources a server/validator could fetch

| Source | Key needed? | What you get | Terms / caveats |
|---|---|---|---|
| **OpenSky Network REST API** | No (anonymous: 400 credits/day, live state vectors only); OAuth2 client-credentials for more (4,000/day standard) | ADS-B state vectors; `/flights/arrival`, `/flights/departure`, `/flights/aircraft` (≤ 2-day windows) with first/last-seen times — **updated by nightly batch** (previous day only) | **Licence covers non-profit research/education only. Any for-profit use, and any operational use in a live product/automated system, needs a written licence** — [Terms](https://opensky-network.org/about/terms-of-use), [API docs](https://openskynetwork.github.io/opensky-api/rest.html). VERIFIED. No scheduled times; ADS-B ≠ door-open |
| **adsbdb** (`api.adsbdb.com/v0/callsign/{CS}`, `/aircraft/{reg}`) | No | Callsign → route (origin/destination/airline), aircraft details | **No schedule or actual times.** Route data credited to D. Taylor/J. Mason — may not be copied into other databases without permission; no stated rate limits ([GitHub](https://github.com/mrjackwills/adsbdb)). VERIFIED |
| **FlightAware public pages** | n/a | Rich status pages | **Terms forbid scraping/robots** (human browser only), commercial/operational/judicial use, and use with **betting, prediction markets or event contracts**. Programmatic access only via paid **AeroAPI** ([Terms](https://www.flightaware.com/about/termsofuse)). VERIFIED — do not scrape |
| **Aviationstack** | Yes (free key) | Real-time flight status; historical on paid plans only | Free = 100 requests/month, **non-commercial use** ([pricing](https://aviationstack.com/pricing)). VERIFIED |
| **AeroDataBox** (direct / API.Market / RapidAPI) | Yes | Flight status by number/date incl. scheduled/actual times (per product description) | Free tier/limits UNVERIFIED ([docs](https://doc.aerodatabox.com/)) |
| **Airline status pages** (e.g. lufthansa.com, ba.com flight status) | No for web pages | Scheduled vs actual, sometimes delay reason | Usually JS-rendered; ToS typically prohibit automated access — UNVERIFIED per airline. Some have official dev APIs needing keys (e.g. Lufthansa Open API — UNVERIFIED current status) |
| **Airport arrival boards / APIs** (e.g. Schiphol Public Flight API, Heathrow/Frankfurt boards) | Schiphol: free key (UNVERIFIED) | Actual on-block/landed times | Per-airport terms — UNVERIFIED |
| **Eurocontrol / national stats, US BTS On-Time data** | No | Historical aggregate delay data (BTS: per-flight, monthly release, US carriers) | Public domain (BTS); lag of ~1–2 months — UNVERIFIED lag |

**Oracle design notes**
- No single free, commercially-licensed, no-key source gives **scheduled + actual arrival + cause**. Expect validators to cross-check 2–3 sources and agree within a tolerance (e.g. ±15 min).
- Hackathon/demo use of OpenSky anonymous API is defensible as non-profit research; a **commercial launch needs a licence** (OpenSky or paid API).
- FlightAware's explicit ban on use with **"prediction markets / event contracts"** is directly relevant to a blockchain settlement product — avoid.
- ADS-B times are touchdown/last-seen, not door-open (see RULES.md §4) → use as a lower bound and mark borderline cases.
