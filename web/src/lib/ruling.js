// Pure helpers: turn an on-chain claim (get_claim) into plain words, a proof
// card model and a claim letter. No network, no DOM: unit-tested offline.

export const OUTCOME_TEXT = {
  OWED: { headline: "You're owed compensation", tone: "good" },
  OWED_UNLESS_EXTRAORDINARY: { headline: "Owed, unless the airline proves extraordinary circumstances", tone: "good" },
  POSSIBLY_OWED_CANCELLATION: { headline: "Possibly owed: it depends on the notice you were given", tone: "maybe" },
  NOT_OWED_UNDER_3H: { headline: "Not owed: arrived less than 3 hours late", tone: "no" },
  NOT_OWED_EXTRAORDINARY: { headline: "Not owed: extraordinary circumstances", tone: "no" },
  NOT_COVERED: { headline: "Not covered by EU261 or UK261", tone: "no" },
  TOO_EARLY: { headline: "Too early: the flight hasn't landed yet", tone: "maybe" },
  FLIGHT_NOT_FOUND: { headline: "No record of this flight on this date", tone: "no" },
  INSUFFICIENT_DATA: { headline: "Not enough public data to decide", tone: "maybe" },
};

export const BUCKET_TEXT = {
  NONE: "no arrival delay recorded",
  LT_2H: "under 2 hours late",
  H2_3: "2 to 3 hours late",
  H3_4: "3 to 4 hours late",
  H4_PLUS: "4 or more hours late",
};

export const CAUSE_TEXT = {
  CONTROLLABLE: "within the airline's control",
  EXTRAORDINARY: "extraordinary circumstances",
  UNKNOWN: "cause not stated publicly",
};

const SYMBOL = { EUR: "€", GBP: "£" };

export function money(amount, currency) {
  if (!amount || !currency) return "";
  return `${SYMBOL[currency] ?? ""}${Number(amount).toLocaleString("en-GB")}`;
}

export function tierName(tier) {
  return { 1: "First review (1 analyst)", 2: "Appeal (3 analysts)", 3: "Final appeal (5 analysts)" }[tier] ?? "Not reviewed yet";
}

/** Plain-language summary of a claim. */
export function describe(claim) {
  if (!claim?.ruling) return { headline: "Waiting for the validators", tone: "maybe", lines: [] };
  const r = claim.ruling;
  const rec = claim.record ?? {};
  const o = OUTCOME_TEXT[r.outcome] ?? { headline: r.outcome, tone: "maybe" };
  const route = rec.route && rec.route.origin ? `${rec.route.origin} → ${rec.route.dest}` : "route unknown";
  const lines = [
    `${claim.flight} on ${claim.date}, ${route}${r.distance_km > 0 ? ` (${r.distance_km.toLocaleString("en-GB")} km)` : ""}`,
    `What happened: ${rec.status === "LANDED" ? "landed, " + BUCKET_TEXT[rec.bucket] : (rec.status ?? "").toLowerCase().replace("_", " ")}`,
    `Why: ${CAUSE_TEXT[rec.cause_class] ?? "unknown"}${rec.cause_label && rec.cause_label !== "not stated" ? ` (${rec.cause_label})` : ""}`,
  ];
  if (r.regime) lines.push(`Rules: ${r.regime}${r.amount ? `, ${money(r.amount, r.currency)} per passenger` : ""}`);
  lines.push(r.explanation);
  return { headline: o.headline, tone: o.tone, amount: money(r.amount, r.currency), lines };
}

/** Claim letter text built only from the on-chain ruling. */
export function claimLetter(claim, { name = "[Your name]", booking = "[Booking reference]", contract, txHash, siteUrl } = {}) {
  const r = claim?.ruling;
  if (!r) return "";
  const payable = r.outcome === "OWED" || r.outcome === "OWED_UNLESS_EXTRAORDINARY" || r.outcome === "POSSIBLY_OWED_CANCELLATION";
  if (!payable) return "";
  const rec = claim.record ?? {};
  const reg = r.regime === "UK261" ? "UK Regulation 261/2004 (UK261)" : "Regulation (EC) No 261/2004 (EU261)";
  const what = rec.status === "CANCELLED"
    ? "was cancelled"
    : `arrived ${BUCKET_TEXT[rec.bucket]} at its final destination`;
  const route = rec.route?.origin ? ` from ${rec.route.origin} to ${rec.route.dest}` : "";
  const ask = r.outcome === "POSSIBLY_OWED_CANCELLATION"
    ? `Please confirm when I was told of the cancellation and what rerouting was offered, and pay the compensation due under ${reg} (${money(r.amount, r.currency)}) if the notice was under 14 days.`
    : `Under ${reg} I am entitled to ${money(r.amount, r.currency)} in compensation.${r.outcome === "OWED_UNLESS_EXTRAORDINARY" ? " If you believe extraordinary circumstances applied, please provide evidence of them." : ""}`;
  return [
    `Subject: Compensation claim, flight ${claim.flight} on ${claim.date}${booking ? `, booking ${booking}` : ""}`,
    "",
    "Dear Customer Relations team,",
    "",
    `I was a passenger on flight ${claim.flight}${route} on ${claim.date}. The flight ${what}.`,
    "",
    ask,
    "",
    `This is supported by a public record: DelayProof claim #${claim.id}${contract ? ` on GenLayer studionet contract ${contract}` : ""}${txHash ? ` (transaction ${txHash})` : ""}. Independent validators each fetched the public flight data and agreed on the record above.${siteUrl ? ` It can be checked at ${siteUrl}?claim=${claim.id}.` : ""}`,
    "",
    "Please reply within 14 days.",
    "",
    "Kind regards,",
    name,
    "",
    "(Information only, not legal advice. Testnet record.)",
  ].join("\n");
}

/** "agree 3, idle 2" from consensus votes. */
export function voteSummary(tx) {
  const votes = tx?.consensus_data?.votes;
  if (!votes || typeof votes !== "object") return "";
  const counts = {};
  for (const v of Object.values(votes)) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
}

/** Client-side mirror of the contract's input checks, for instant feedback. */
export function checkInputs({ flight, date, note = "", evidence = [] }, today = new Date()) {
  const errors = [];
  const f = String(flight ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z0-9]{2})([0-9]{1,4})([A-Z]?)$/.exec(f);
  if (!m || !/[A-Z]/.test(m[1])) errors.push("Flight should look like BA117.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) errors.push("Pick the date the flight was scheduled to leave.");
  else if (date > today.toISOString().slice(0, 10)) errors.push("That date is in the future.");
  if (note.length > 280) errors.push("Keep the note under 280 characters.");
  if (/ignore (?:all |any |the )?(?:previous|prior|above)|system prompt|disregard/i.test(note)) errors.push("The note can't contain instructions to the analysts.");
  if (evidence.length > 3) errors.push("At most 3 evidence links.");
  for (const u of evidence) if (!/^https:\/\/[A-Za-z0-9.-]+(\/\S*)?$/.test(u) || u.length > 300) errors.push(`Evidence link must be https: ${u}`);
  return { ok: errors.length === 0, errors, flight: m ? m[1] + String(Number(m[2])) + m[3] : f };
}
