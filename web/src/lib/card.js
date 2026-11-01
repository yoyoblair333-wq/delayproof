// Proof card: a shareable 1080x1350 SVG built only from a real on-chain claim
// (get_claim) plus the validator votes of the tx that decided it. Pure: no DOM,
// no network, unit-tested offline. app.js rasterises it to PNG for sharing.
import { cardState, describe, hm, money, PAYABLE, regimeCurrency, shownRoute } from "./ruling.js";

const X = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Always-dark "board" palette (the owed verdict and the card look the same in any theme).
const P = { bg: "#0E141D", bg2: "#161E2A", line: "#2A3646", text: "#F4F1EA", muted: "#AEB8C6", amber: "#FFB547", owed: "#5FD7A1", review: "#8FB1FF", appeal: "#B9A5FB", no: "#A3AEBF", paid: "#5FD7A1" };

export const STATE_COPY = {
  owed: { eyebrow: "THE VALIDATORS AGREED", title: "You're owed", accent: P.amber, seal: "AGREED BY GENLAYER-HOSTED VALIDATORS" },
  "owed-unless": { eyebrow: "THE VALIDATORS AGREED", title: "Owed, unless the airline proves", accent: P.amber, seal: "AGREED BY GENLAYER-HOSTED VALIDATORS", sub: "extraordinary circumstances" },
  halved: { eyebrow: "THE VALIDATORS AGREED", title: "You're owed", accent: P.amber, seal: "AGREED BY GENLAYER-HOSTED VALIDATORS", sub: "Long-haul, 3 to 4 hours late: the rules halve it" },
  "appeal-upheld": { eyebrow: "CHANGED ON APPEAL", title: "Appeal won: owed", accent: P.appeal, seal: "A BIGGER PANEL CHANGED THE RULING" },
  paid: { eyebrow: "TEST POOL PAYOUT", title: "Test payout", accent: P.paid, seal: "TEST POOL · NO REAL FUNDS" },
  review: { eyebrow: "FLAGGED, NOT GUESSED", title: "Needs a closer look", accent: P.review, seal: "VALIDATORS FLAGGED IT" },
  "not-owed": { eyebrow: "THE VALIDATORS AGREED", title: "Not owed this time", accent: P.no, seal: "AGREED BY GENLAYER-HOSTED VALIDATORS" },
  "not-found": { eyebrow: "NO FLIGHT RECORD FOUND", title: "No record found", accent: P.review, seal: "NOTHING TO RULE ON YET" },
  possibly: { eyebrow: "DEPENDS ON THE NOTICE", title: "Possibly owed, up to", accent: P.review, seal: "AGREED BY GENLAYER-HOSTED VALIDATORS", sub: "depending on the notice and rerouting you were given" },
  pending: { eyebrow: "WAITING FOR THE NETWORK", title: "Not assessed yet", accent: P.no, seal: "PENDING" },
};

function tiles(text, x, y, accent) {
  const chars = [...text];
  const w = 104, h = 150, gap = 10;
  const start = x - (chars.length * (w + gap) - gap) / 2;
  return chars.map((ch, i) => {
    const tx = start + i * (w + gap);
    return `<g><rect x="${tx}" y="${y}" width="${w}" height="${h}" rx="12" fill="${P.bg2}" stroke="${P.line}"/><line x1="${tx}" y1="${y + h / 2}" x2="${tx + w}" y2="${y + h / 2}" stroke="${P.bg}" stroke-width="3"/><text x="${tx + w / 2}" y="${y + h / 2 + 38}" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="108" fill="${accent}">${X(ch)}</text></g>`;
  }).join("");
}

function tally(votes) {
  if (!votes?.length) return "";
  const c = {};
  for (const v of votes) c[v] = (c[v] ?? 0) + 1;
  return Object.entries(c).map(([k, n]) => `${k} ${n}`).join(", ");
}

/**
 * @param claim  plain object from get_claim
 * @param opts   { votes: ["agree",…], contract, sample: bool }
 * @returns { state, svg, alt }
 */
export function proofCardSVG(claim, { votes = [], contract = "", sample = false } = {}) {
  const state = cardState(claim);
  const r = claim?.ruling ?? {};
  const possibly = r.outcome === "POSSIBLY_OWED_CANCELLATION";
  const unless = r.outcome === "OWED_UNLESS_EXTRAORDINARY";
  let k = STATE_COPY[possibly ? "possibly" : state === "owed" && unless ? "owed-unless" : state];
  // halved and appeal-won rulings can still be "owed unless" (QUALITY-R2 P2-6)
  if (unless && state === "halved") k = { ...k, title: "Owed, unless the airline proves", sub: `extraordinary circumstances. ${k.sub}` };
  if (unless && state === "appeal-upheld") k = { ...k, title: "Appeal won: owed, unless", sub: "the airline proves extraordinary circumstances" };
  const rec = claim?.record ?? {};
  const route = shownRoute(claim);
  // the currency (and so "€0") is only a fact when the route, and with it the rule, was confirmed
  const cur = route.origin ? regimeCurrency(r.regime) : "";
  const amount = PAYABLE.has(r.outcome) || possibly ? money(r.amount, r.currency || cur) : state === "not-owed" && cur ? (cur === "GBP" ? "£0" : "€0") : "";
  // NONE means "no arrival delay established" (unknown, cancelled or diverted), never "on time".
  const BAND = { LT_2H: "Under 2h late", H2_3: "2 to 3h late", H3_4: "3 to 4h late", H4_PLUS: "4h+ late" };
  const delay = rec.status === "CANCELLED" ? "Cancelled (agreed)" : rec.status === "DIVERTED" ? `Diverted${BAND[rec.bucket] ? `, ${BAND[rec.bucket].toLowerCase()}` : ""} (agreed)`
    : BAND[rec.bucket] ? `${BAND[rec.bucket]} (agreed)` : rec.status === "LANDED" ? "Arrival delay not established" : "";
  const reported = rec.status !== "CANCELLED" && hm(rec.delay_min) ? `${hm(rec.delay_min)} at the gate, per the public record` : "";
  const d = describe(claim);
  const why = state === "halved" ? k.sub : possibly ? `${k.sub}. Cancelled.` : k.sub && (state === "owed" || state === "appeal-upheld") ? `${k.sub}. ${r.explanation ?? ""}` : (r.explanation ?? "");
  const wrapped = wrap(why, 52).slice(0, 3);
  const t = tally(votes);
  // no amount tiles: move the heading block down so the text sits near the ticket, not above a dead gap
  const off = amount ? 0 : 120;
  const alt = `${k.title}${amount ? " " + amount : ""}. Flight ${claim?.flight ?? ""} on ${claim?.date ?? ""}${route.origin ? `, ${route.origin} to ${route.dest}` : ""}${delay ? `, ${delay}` : ""}.${t ? " " + t + "." : ""} Information, not legal advice. Test mode.`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350" role="img" aria-label="${X(alt)}">
<rect width="1080" height="1350" fill="${P.bg}"/>
<rect x="24" y="24" width="1032" height="1302" rx="36" fill="none" stroke="${P.line}" stroke-width="2"/>
<g transform="translate(72 84)"><rect width="56" height="56" rx="12" fill="${P.amber}"/><path d="M14 30l9 9 19-21" stroke="${P.bg}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="76" y="40" font-family="'Schibsted Grotesk','Inter',system-ui,sans-serif" font-weight="800" font-size="36" fill="${P.text}">DelayProof</text></g>
<g transform="translate(1008 84)"><rect x="-236" width="236" height="48" rx="24" fill="${P.amber}"/><text x="-118" y="32" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="20" fill="${P.bg}">${sample ? "SAMPLE · TEST MODE" : "TEST MODE"}</text></g>
<text x="540" y="${246 + off}" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="26" letter-spacing="4" fill="${k.accent}">${X(k.eyebrow)}</text>
<text x="540" y="${322 + off}" text-anchor="middle" font-family="'Schibsted Grotesk','Inter',system-ui,sans-serif" font-weight="800" font-size="64" fill="${P.text}">${X(k.title)}</text>
${amount ? tiles(amount, 540, 370, k.accent) : ""}
${amount ? `<text x="540" y="572" text-anchor="middle" font-family="'Inter',system-ui,sans-serif" font-size="26" fill="${P.muted}">${possibly ? "maximum " : ""}per passenger${r.regime ? ` · under ${X(r.regime === "UK261" ? "UK 261" : "EU 261/2004")}` : ""}</text>` : ""}
${wrapped.map((l, i) => `<text x="540" y="${(amount ? 632 : 420 + off) + i * 38}" text-anchor="middle" font-family="'Inter',system-ui,sans-serif" font-size="28" fill="${P.text}">${X(l)}</text>`).join("")}
<g transform="translate(72 770)">
<rect width="936" height="300" rx="24" fill="${P.bg2}" stroke="${P.line}"/>
<line x1="660" y1="0" x2="660" y2="300" stroke="${P.line}" stroke-dasharray="8 8"/>
<text x="40" y="66" font-family="'IBM Plex Mono',ui-monospace,monospace" font-size="22" fill="${P.muted}">FLIGHT ${X(claim?.flight)} · ${X(claim?.date)}</text>
<text x="40" y="150" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="76" fill="${P.text}">${X(route.origin || "···")}</text>
<line x1="230" y1="124" x2="400" y2="124" stroke="${P.amber}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
<text x="430" y="150" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="76" fill="${P.text}">${X(route.dest || "···")}</text>
<text x="40" y="214" font-family="'Inter',system-ui,sans-serif" font-size="26" fill="${P.amber}">${X(delay || d.lines[1]?.replace("What happened: ", "") || "")}</text>
<text x="40" y="256" font-family="'Inter',system-ui,sans-serif" font-size="24" fill="${P.muted}">${X(reported)}${r.distance_km > 0 && route.origin ? `${reported ? " · " : ""}${Number(r.distance_km).toLocaleString("en-GB")} km` : ""}</text>
<text x="700" y="66" font-family="'IBM Plex Mono',ui-monospace,monospace" font-size="20" fill="${P.muted}">RULING</text>
<text x="700" y="110" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="34" fill="${P.text}">#${X(claim?.id ?? "")}</text>
<text x="700" y="166" font-family="'IBM Plex Mono',ui-monospace,monospace" font-size="20" fill="${P.muted}">PANEL</text>
<text x="700" y="204" font-family="'Inter',system-ui,sans-serif" font-size="26" fill="${P.text}">${X(claim?.analysts ? `${claim.analysts} analyst${claim.analysts > 1 ? "s" : ""}` : "")}</text>
<text x="700" y="234" font-family="'IBM Plex Mono',ui-monospace,monospace" font-size="20" fill="${P.muted}">${t ? "VALIDATOR VOTES" : ""}</text>
<text x="700" y="268" font-family="'Inter',system-ui,sans-serif" font-size="24" fill="${k.accent}">${X(t)}</text>
</g>
<text x="540" y="1140" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="22" letter-spacing="3" fill="${k.accent}">${X(k.seal)}</text>
<text x="540" y="1186" text-anchor="middle" font-family="'Inter',system-ui,sans-serif" font-size="22" fill="${P.muted}">${contract ? `Public record: GenLayer studionet ${X(contract.slice(0, 8))}…${X(contract.slice(-4))}` : "Public record on GenLayer studionet"}</text>
<text x="540" y="1238" text-anchor="middle" font-family="'Inter',system-ui,sans-serif" font-size="28" fill="${P.text}">Information, not legal advice. Airlines aren't</text>
<text x="540" y="1276" text-anchor="middle" font-family="'Inter',system-ui,sans-serif" font-size="28" fill="${P.text}">legally bound by this ruling. Test mode: no real money.</text>
${state === "paid" ? `<g transform="rotate(-24 540 470)" opacity="0.92"><rect x="40" y="420" width="1000" height="100" fill="#B42318"/><text x="540" y="488" text-anchor="middle" font-family="'IBM Plex Mono',ui-monospace,monospace" font-weight="600" font-size="46" fill="#FFFFFF">TEST · NOT A REAL PAYMENT</text></g>` : ""}
</svg>`;
  return { state, svg, alt };
}

export function wrap(text, width) {
  const out = [];
  let line = "";
  for (const w of String(text ?? "").split(/\s+/).filter(Boolean)) {
    if ((line + " " + w).trim().length > width) { if (line) out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}
