// SAMPLE claims for ?sample=<state> previews only. They are made-up (flight
// codes XX…), are labelled "Sample" everywhere they appear, are never written
// on-chain and never enter the Trip Wallet. The live flow only shows claims
// read back from the contract.
const route = (o, d, oc = "PT", dc = "NL", air = "XX") => ({ airline: air, airline_country: oc, origin: o, dest: d, origin_country: oc, dest_country: dc });
const base = (id, flight, rec, ruling, extra = {}) => ({
  id, flight, date: "2026-10-12", status: "assessed", tier: 1, analysts: 1, claimant: "0x0000000000000000000000000000000000000000",
  note: "", evidence: [], paid: false, pool_id: 0, history: [], record: { sources: [{ name: "flightstats", ok: true }, { name: "adsbdb", ok: true }], analysts: [], cause_label: "not stated", seen_route: rec.route ? `${rec.route.origin}-${rec.route.dest}` : "-", ...rec },
  ruling: { rules_version: "delayproof-rules-v1", flags: [], ...ruling }, ...extra,
});

export const SAMPLES = {
  owed: base(9001, "XX123",
    { status: "LANDED", bucket: "H3_4", delay_min: 227, cause_class: "CONTROLLABLE", cause_label: "technical fault", route: route("LIS", "AMS"), reason: "Sample: the record shows a 3h 47m late arrival after a technical fault." },
    { outcome: "OWED", regime: "EU261", amount: 400, currency: "EUR", band: "medium", bucket: "H3_4", delay_min: 227, distance_km: 1858, rule_set: "EU261 (3 hours or more)", explanation: "Arrived 3+ hours late for a reason within the airline's control." }),
  halved: base(9002, "XX456",
    { status: "LANDED", bucket: "H3_4", delay_min: 205, cause_class: "UNKNOWN", route: route("LHR", "JFK", "GB", "US"), reason: "Sample: long-haul, 3h 25m late, no cause published." },
    { outcome: "OWED_UNLESS_EXTRAORDINARY", regime: "UK261", amount: 260, currency: "GBP", band: "long", bucket: "H3_4", delay_min: 205, distance_km: 5540, rule_set: "UK261", explanation: "Long-haul 3 to 4 hours late: the rules halve it. Owed unless the airline proves extraordinary circumstances." }),
  review: base(9003, "XX789",
    { status: "LANDED", bucket: "H2_3", delay_min: 171, cause_class: "UNKNOWN", route: route("MAD", "CDG", "ES", "FR"), reason: "Sample: 2h 51m at the gate; doors open a few minutes later." },
    { outcome: "BORDERLINE", regime: "EU261", amount: 0, currency: "", band: "short", bucket: "H2_3", delay_min: 171, distance_km: 1063, rule_set: "EU261", explanation: "Arrived 171 min late at the gate. Doors open a few minutes after that, so this may cross the 3-hour line; check your own arrival time." }),
  "not-owed": base(9004, "XX321",
    { status: "LANDED", bucket: "H4_PLUS", delay_min: 262, cause_class: "EXTRAORDINARY", cause_label: "air-traffic-control strike", route: route("FCO", "DUB", "IT", "IE"), reason: "Sample: an ATC strike was reported for the route that day." },
    { outcome: "LIKELY_EXTRAORDINARY", regime: "EU261", amount: 0, currency: "EUR", band: "medium", bucket: "H4_PLUS", delay_min: 262, distance_km: 1885, rule_set: "EU261", explanation: "Arrived 3+ hours late, but public evidence points to extraordinary circumstances, which the airline must still prove." }),
};
SAMPLES["appeal-upheld"] = { ...structuredClone(SAMPLES.owed), id: 9005, tier: 2, analysts: 3,
  history: [{ tier: 1, record: SAMPLES["not-owed"].record, ruling: { ...SAMPLES["not-owed"].ruling } }] };
SAMPLES.paid = { ...structuredClone(SAMPLES.owed), id: 9006, status: "final", paid: true, pool_id: 1 };

export const SAMPLE_VOTES = ["agree", "agree", "agree", "idle", "idle"];
