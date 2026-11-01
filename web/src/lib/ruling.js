// Pure helpers: turn an on-chain claim (get_claim) into plain words, a proof
// card model and a claim letter. No network, no DOM: unit-tested offline.

export const OUTCOME_TEXT = {
  OWED: { headline: "You're owed compensation", tone: "good" },
  OWED_UNLESS_EXTRAORDINARY: { headline: "Owed, unless the airline proves extraordinary circumstances", tone: "good" },
  POSSIBLY_OWED_CANCELLATION: { headline: "Possibly owed: it depends on the notice you were given", tone: "maybe" },
  BORDERLINE: { headline: "Right on the 3-hour line: this one needs a closer look", tone: "maybe" },
  NOT_OWED_UNDER_3H: { headline: "Not owed: arrived less than 3 hours late", tone: "no" },
  LIKELY_EXTRAORDINARY: { headline: "Not owed this time: likely extraordinary circumstances", tone: "no" },
  NOT_OWED_EXTRAORDINARY: { headline: "Not owed: extraordinary circumstances", tone: "no" },
  NOT_COVERED: { headline: "Not covered by EU261 or UK261", tone: "no" },
  TOO_EARLY: { headline: "Too early: the flight hasn't landed yet", tone: "maybe" },
  FLIGHT_NOT_FOUND: { headline: "No record of this flight on this date", tone: "no" },
  INSUFFICIENT_DATA: { headline: "Not enough public data to decide", tone: "maybe" },
};

export const PAYABLE = new Set(["OWED", "OWED_UNLESS_EXTRAORDINARY"]);
const REVIEW = new Set(["BORDERLINE", "POSSIBLY_OWED_CANCELLATION", "INSUFFICIENT_DATA", "TOO_EARLY"]);

/** EUR for EU261, GBP for UK261, "" when no regime applies. */
export function regimeCurrency(regime) {
  return regime === "UK261" ? "GBP" : regime === "EU261" ? "EUR" : "";
}

/** The route to display: empty when the contract rejected it (route_conflict). */
export function shownRoute(claim) {
  const flags = claim?.ruling?.flags ?? [];
  if (flags.includes("route_conflict")) return {};
  return claim?.record?.route ?? {};
}

/**
 * Which designed state a real on-chain claim maps to:
 * owed | halved | appeal-upheld | paid | review | not-owed | pending.
 * Only ever derived from the claim returned by get_claim.
 */
export function cardState(claim) {
  const r = claim?.ruling;
  if (!r) return "pending";
  if (PAYABLE.has(r.outcome)) {
    if (claim.paid) return "paid";
    const prev = (claim.history ?? []).at(-1)?.ruling;
    if (claim.tier > 1 && prev && !PAYABLE.has(prev.outcome)) return "appeal-upheld";
    if (r.band === "long" && r.bucket === "H3_4") return "halved";
    return "owed";
  }
  if (r.outcome === "FLIGHT_NOT_FOUND") return "not-found";
  if (REVIEW.has(r.outcome)) return "review";
  return "not-owed";
}

/** "3h 47m" from minutes; "" when unknown. */
export function hm(min) {
  const m = Number(min);
  if (!Number.isFinite(m) || m < 0) return "";
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Validator votes from a GenLayer tx: [{v:"agree"|"disagree"|"idle"|...}] in a stable order. */
export function voteDots(tx) {
  const votes = tx?.consensus_data?.votes;
  if (!votes || typeof votes !== "object") return [];
  const order = { agree: 0, disagree: 1, timeout: 2, idle: 3 };
  return Object.values(votes).map(String).sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
}

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
  const sr = shownRoute(claim);
  const route = sr.origin ? `${sr.origin} → ${sr.dest}` : (r.flags ?? []).includes("route_conflict") ? "route disputed" : "route unknown";
  const happened = rec.status === "LANDED" ? (rec.bucket === "NONE" ? "landed, arrival delay not established" : "landed, " + BUCKET_TEXT[rec.bucket])
    : rec.status === "DIVERTED" ? `diverted${rec.bucket !== "NONE" ? ", " + BUCKET_TEXT[rec.bucket] : ""}` : (rec.status ?? "").toLowerCase().replace("_", " ");
  const lines = [
    `${claim.flight} on ${claim.date}, ${route}${r.distance_km > 0 && sr.origin ? ` (${r.distance_km.toLocaleString("en-GB")} km)` : ""}`,
    `What happened: ${happened}`,
    `Why: ${CAUSE_TEXT[rec.cause_class] ?? "unknown"}${rec.cause_label && rec.cause_label !== "not stated" ? ` (${rec.cause_label})` : ""}`,
  ];
  if (r.regime) lines.push(`Rules: ${r.regime}${r.amount ? `, ${r.outcome === "POSSIBLY_OWED_CANCELLATION" ? "up to " : ""}${money(r.amount, r.currency)} per passenger` : ""}`);
  lines.push(r.explanation);
  return { headline: o.headline, tone: o.tone, amount: money(r.amount, r.currency), lines };
}

/** Claim letter text built only from the on-chain ruling. It says which public
 * source decided what, and never asserts a legal entitlement. */
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
  const sr = shownRoute(claim);
  const route = sr.origin ? ` from ${sr.origin} to ${sr.dest}` : "";
  const ask = r.outcome === "POSSIBLY_OWED_CANCELLATION"
    ? `Please confirm when I was told of the cancellation and what rerouting was offered. If the notice was under 14 days, compensation of up to ${money(r.amount, r.currency)} may be owed under ${reg}.`
    : `On this record, compensation of ${money(r.amount, r.currency)} may be owed under ${reg}.${r.outcome === "OWED_UNLESS_EXTRAORDINARY" ? " No cause was published; if you believe extraordinary circumstances applied, please provide evidence of them." : ""} Please review my claim.`;
  const ev = (claim.evidence ?? []).map((e) => e.url);
  const timing = "The flight's status and arrival time come from the public flight-status page (FlightStats) for that date; attached pages were not used for timing.";
  const cause = rec.cause_class === "UNKNOWN"
    ? "No public source stated a cause."
    : `The cause (${CAUSE_TEXT[rec.cause_class]}${rec.cause_label && rec.cause_label !== "not stated" ? `: ${rec.cause_label}` : ""}) was assessed from the flight-status page${ev.length ? ` and the attached public page${ev.length > 1 ? "s" : ""} ${ev.join(", ")}` : ""}.`;
  return [
    `Subject: Compensation claim, flight ${claim.flight} on ${claim.date}${booking ? `, booking ${booking}` : ""}`,
    "",
    "Dear Customer Relations team,",
    "",
    `I was a passenger on flight ${claim.flight}${route} on ${claim.date}. The flight ${what}.`,
    "",
    ask,
    "",
    `Supporting public record: DelayProof claim #${claim.id}${contract ? ` on GenLayer studionet contract ${contract}` : ""}${txHash ? ` (transaction ${txHash})` : ""}. Validators hosted by GenLayer each fetched the public data themselves and agreed on this record. ${timing} ${cause}${siteUrl ? ` It can be checked at ${siteUrl}?claim=${claim.id}.` : ""}`,
    "",
    "Please reply within 14 days.",
    "",
    "Kind regards,",
    name,
    "",
    "(Information only, not legal advice. Testnet record; it does not bind the airline.)",
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
  const m = /^([A-Z]{3}|[A-Z0-9]{2})([0-9]{1,4})([A-Z]?)$/.exec(f);
  if (!m || !/[A-Z]/.test(m[1])) errors.push("Flight should look like BA117 or LOG31.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) errors.push("Pick the date the flight was scheduled to leave.");
  else if (date > today.toISOString().slice(0, 10)) errors.push("That date is in the future.");
  if (note.length > 280) errors.push("Keep the note under 280 characters.");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(note)) errors.push("The note is public: please remove the email address.");
  if (/\b(?:booking|pnr|reservation|confirmation|ref(?:erence)?)\b/i.test(note) && /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6}\b/.test(note)) errors.push("The note is public: please remove the booking reference.");
  if (evidence.length > 3) errors.push("At most 3 evidence links.");
  for (const u of evidence) {
    const host = (/^https:\/\/([A-Za-z0-9.-]+)(\/\S*)?$/.exec(u)?.[1] ?? "").toLowerCase();
    if (!host || u.length > 300) errors.push(`Evidence link must be a plain https link: ${u}`);
    else if (!host.includes(".") || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /\.(local|localhost|internal|lan|home|corp|intranet|arpa)$/.test(host)) errors.push(`Evidence link must use a public website name: ${u}`);
    else if (/pnr|lastname|last_name|surname|bookingref|booking_ref|recordlocator|manage[-_]?booking|mytrips|my-trips|checkin|check-in/i.test(u)) errors.push(`That looks like a booking page; links are public, so use a notice or news page: ${u}`);
  }
  return { ok: errors.length === 0, errors, flight: m ? m[1] + String(Number(m[2])) + m[3] : f };
}
