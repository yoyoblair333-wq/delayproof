// DelayProof web app. Opens a claim, asks the validators to assess it, follows
// the transaction to finality and shows the agreed ruling, a proof card and a
// claim letter. Every write is signed in this browser by a testnet burner key.
// Everything shown in the live flow is read back from the contract or from the
// transaction itself; ?sample=<state> previews use labelled made-up claims and
// never write anything. genlayer-js (and its signer) is loaded with import()
// after first paint, so it never blocks the page.
import * as C from "./config.js";
import { classifyTx, voteSummary, revertReason } from "./lib/finality.js";
import { describe, claimLetter, tierName, checkInputs, cardState, hm, money, voteDots, PAYABLE, BUCKET_TEXT, CAUSE_TEXT, shownRoute } from "./lib/ruling.js";
import { proofCardSVG, STATE_COPY } from "./lib/card.js";
import { WALLET_KEY, STAMPS, emptyWallet, addTrip, stamp, totals, tripsNewestFirst } from "./lib/wallet.js";
import { SAMPLES, SAMPLE_VOTES } from "./lib/samples.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));
const icon = (name, label = "") => `<svg class="ic" width="20" height="20" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><use href="assets/icons.svg#dp-${name}"/></svg>`;

let glp = null;
const gl = () => (glp ??= Promise.all([import("genlayer-js"), import("genlayer-js/chains")]).then(([g, ch]) => ({ ...g, studionet: ch.studionet })));
let readerP = null;
const reader = () => (readerP ??= gl().then((g) => g.createClient({ chain: g.studionet })));
const LIVE = /^0x[0-9a-fA-F]{40}$/.test(C.CONTRACT_ADDRESS) && !/^0x0+$/.test(C.CONTRACT_ADDRESS);
const params = new URLSearchParams(location.search);
const SAMPLE = params.get("sample");
const SAMPLE_MODE = SAMPLE !== null;

// ------------------------------------------------------------------ storage (per browser, best effort)
function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? "null");
    localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
  return value;
}
let account = null;
let myAddress = "";
async function signer() {
  if (account) return account;
  const g = await gl();
  let b = store(C.BURNER_KEY);
  if (!b?.privateKey) { b = { privateKey: g.generatePrivateKey(), note: "studionet testnet only, holds nothing of value" }; store(C.BURNER_KEY, b); }
  account = g.createAccount(b.privateKey);
  myAddress = account.address.toLowerCase();
  return account;
}
// The burner's address, if this browser already has one (no key is created just to look).
async function knownMe() {
  if (myAddress) return myAddress;
  if (!store(C.BURNER_KEY)?.privateKey) return "";
  try { return (await signer()).address.toLowerCase(); } catch { return ""; }
}
const me = () => myAddress;
const writer = async () => { const g = await gl(); return g.createClient({ chain: g.studionet, account: await signer() }); };
let wallet = store(WALLET_KEY) ?? emptyWallet();
function saveWallet() { store(WALLET_KEY, wallet); renderWallet(); }

async function readContract(functionName, args) { return plain(await (await reader()).readContract({ address: C.CONTRACT_ADDRESS, functionName, args })); }
async function readClaim(id) { await knownMe(); return plain(await (await reader()).readContract({ address: C.CONTRACT_ADDRESS, functionName: "get_claim", args: [BigInt(id)] })); }

function toast(text, kind = "info") {
  const t = document.createElement("div");
  t.className = `dp-toast dp-toast--${kind}`;
  t.setAttribute("role", kind === "error" ? "alert" : "status");
  t.textContent = text;
  $("toasts").append(t);
  setTimeout(() => t.remove(), 5000);
}

function tallyText(votes) {
  const c = {};
  for (const v of votes) c[v] = (c[v] ?? 0) + 1;
  return Object.entries(c).map(([k, n]) => `${k} ${n}`).join(", ");
}

// ------------------------------------------------------------------ checking board + status rail
const STEPS = ["open", "fetch", "agree", "final"];
const QUIPS = ["Faster than the baggage carousel.", "Each validator reads the record on its own.", "Arrival times come only from the flight-status page.", "They have to agree, or it gets flagged instead of guessed."];
let quipTimer = 0;
function rail(step, note = "", failed = false) {
  $("checking").hidden = false;
  const i = step === "done" ? STEPS.length : STEPS.indexOf(step);
  for (const li of $("rail").querySelectorAll("li")) {
    const j = STEPS.indexOf(li.dataset.step);
    li.classList.toggle("is-done", j < i);
    li.classList.toggle("is-now", j === i && !failed);
    li.classList.toggle("is-fail", j === i && failed);
    if (li.querySelector(".dp-rail__node")) li.querySelector(".dp-rail__node").textContent = j < i ? "✓" : j === i && failed ? "!" : String(j + 1);
    if (j === i && note) li.querySelector("[data-meta]").textContent = note;
  }
  const board = $("checking").querySelector(".board");
  board.dataset.phase = failed ? "fail" : step === "done" ? "done" : step;
  clearInterval(quipTimer);
  if (!failed && (step === "fetch" || step === "agree")) {
    let q = 0;
    $("quip").textContent = QUIPS[0];
    quipTimer = setInterval(() => { $("quip").textContent = QUIPS[++q % QUIPS.length]; }, 4500);
  } else $("quip").textContent = failed ? "Nothing was lost: your claim is saved on-chain if it was recorded." : "";
}
function showDots(votes) {
  if (!votes.length) return;
  const d = $("dots");
  d.hidden = false;
  d.querySelector(".dp-dots").innerHTML = votes.map((v) => `<i class="dp-dot ${v === "agree" ? "is-agree" : v === "disagree" ? "is-disagree" : ""}"></i>`).join("");
  d.querySelector(".dp-validators__label").textContent = `Validators: ${tallyText(votes)}`;
}

// Polls until FINALIZED (ACCEPTED is reported but is not final on GenLayer).
async function follow(hash, onState) {
  const end = Date.now() + C.TX_TIMEOUT_MS;
  const r = await reader();
  let last = "";
  while (Date.now() < end) {
    let tx = null;
    try { tx = await r.getTransaction({ hash }); } catch { /* not indexed yet */ }
    const c = classifyTx(tx);
    if (c.chainStatus !== last) { last = c.chainStatus; onState?.(c, tx); }
    if (c.finality === "FINALIZED_SUCCESS" || c.finality === "FINALIZED_ERROR") return { c, tx };
    if (c.finality === "ACCEPTED" && c.execution === "ERROR") return { c, tx };
    await sleep(C.POLL_MS);
  }
  throw new Error("The network is slow. Your claim is saved; check back from Recent rulings.");
}

// ------------------------------------------------------------------ result view
const VERDICT_CLASS = { owed: "owed", halved: "owed", "appeal-upheld": "owed", paid: "owed", review: "review", "not-found": "review", "not-owed": "not-owed", pending: "review" };
function verdictBody(claim, state, votes) {
  const r = claim.ruling ?? {};
  const rec = claim.record ?? {};
  const agree = votes.length ? `The validators reached agreement (${tallyText(votes)})` : "The validators reached agreement";
  const band = BUCKET_TEXT[rec.bucket] ?? "late";
  const gate = hm(rec.delay_min) ? ` The flight-status page shows ${hm(rec.delay_min)} at the gate; each validator's own reading had to land within 15 minutes of that and give the same outcome.` : "";
  if (state === "owed" || state === "halved" || state === "appeal-upheld" || state === "paid") {
    const why = r.outcome === "OWED_UNLESS_EXTRAORDINARY" ? "no cause was published, so it's owed unless the airline proves extraordinary circumstances" : `the cause was ${CAUSE_TEXT[rec.cause_class] ?? "found"}`;
    return `${agree}: your ${r.distance_km > 0 ? Number(r.distance_km).toLocaleString("en-GB") + " km " : ""}flight arrived ${band}, and ${why}. That's ${money(r.amount, r.currency)} per passenger under ${r.regime === "UK261" ? "UK 261" : "EU 261/2004"}.${state === "halved" ? " Long-haul and 3 to 4 hours late, so the rules halve it." : ""}${gate}`;
  }
  if (state === "not-found") return `${r.explanation ?? ""} Check the flight number and the scheduled departure date (local time). Nothing was ruled.`;
  if (state === "review" && r.outcome === "POSSIBLY_OWED_CANCELLATION") return `${r.explanation ?? ""} Under ${r.regime === "UK261" ? "UK 261" : "EU 261/2004"} the most it can be is ${money(r.amount, r.currency)} per passenger; less notice means more is likely owed.`;
  if (state === "review") return `${r.explanation ?? ""} Rather than guess, the validators flagged it. Adding a public link (for example the airline's delay notice) and appealing to a bigger panel often settles it.`;
  if (state === "not-owed") return `${r.explanation ?? ""}${r.outcome === "LIKELY_EXTRAORDINARY" ? " We know that stings. You may still be owed meals or care on the day." : r.outcome === "NOT_OWED_UNDER_3H" ? " You may still be owed meals or care on the day." : ""}`;
  return "The validators haven't ruled yet.";
}

let current = { claim: null, txs: {}, votes: [], sample: false };
function renderResult(claim, { txs = {}, votes = [], sample = false } = {}) {
  current = { claim, txs, votes, sample };
  const state = cardState(claim);
  const k = STATE_COPY[state];
  const r = claim.ruling ?? {};
  const unless = (state === "owed" || state === "halved") && r.outcome === "OWED_UNLESS_EXTRAORDINARY";
  const rec = claim.record ?? {};
  const route = shownRoute(claim);
  const conflict = (r.flags ?? []).includes("route_conflict");
  const d = describe(claim);
  const possibly = r.outcome === "POSSIBLY_OWED_CANCELLATION";
  const amount = PAYABLE.has(r.outcome) || possibly ? money(r.amount, r.currency) : "";
  // Parties are the claimant, the linked pool's payer and the airline's registered respondent.
  // This page only ever signs as this browser's claimant key, so it offers actions to the claimant only.
  const mine = !sample && !!me() && claim.claimant?.toLowerCase() === me();
  const windowEnds = Date.parse(claim.challenge_ends ?? "");
  const windowOpen = Number.isFinite(windowEnds) && Date.now() < windowEnds;
  const canAssess = mine && claim.status === "open";
  const canAppeal = mine && claim.status === "assessed" && claim.tier < 3;
  const canFinalize = mine && claim.status === "assessed" && !windowOpen;
  const canEvidence = mine && claim.status !== "final";
  const canWithdraw = mine && claim.status === "final" && PAYABLE.has(r.outcome) && Number(claim.pool_id) > 0 && claim.approved && !claim.paid;
  const letter = claimLetter(claim, { contract: C.CONTRACT_ADDRESS, txHash: txs.assess, siteUrl: C.SITE_URL || location.href.split("?")[0] });
  const card = proofCardSVG(claim, { votes, contract: LIVE ? C.CONTRACT_ADDRESS : "", sample });
  const history = (claim.history ?? []).map((h) => `<li>${esc(tierName(h.tier))}: ${esc((describe({ ...claim, ruling: h.ruling, record: h.record })).headline)}</li>`).join("");
  const sources = (rec.sources ?? []).map((s) => `<li class="dp-chip ${s.ok ? "dp-chip--owed" : "dp-chip--late"}">${esc(s.name)}: ${s.ok ? "loaded" : "failed"}</li>`).join("");
  const analysts = (rec.analysts ?? []).map((a, i) => `<li>Analyst ${i + 1}: ${esc(a.status)}${Number(a.delay_min) >= 0 ? `, ${Number(a.delay_min)} min` : ""}, ${esc(CAUSE_TEXT[a.cause_class] ?? a.cause_class)}</li>`).join("");

  $("result").hidden = false;
  $("result").innerHTML = `
    <article class="dp-verdict dp-verdict--${VERDICT_CLASS[state] ?? "review"}${amount ? " reveal" : ""}" aria-labelledby="v-title" data-state="${state}">
      ${state === "owed" || state === "halved" || state === "appeal-upheld" || state === "paid" ? `<div class="dp-verdict__seal" aria-hidden="true"><span><b>${state === "appeal-upheld" ? "Changed" : state === "paid" ? "Test" : "Agreed"}</b>${state === "appeal-upheld" ? "on appeal" : state === "paid" ? "payout" : "by validators"}</span></div>` : ""}
      <p class="dp-verdict__eyebrow">${sample ? "Sample · " : ""}${esc(k.eyebrow.charAt(0) + k.eyebrow.slice(1).toLowerCase())}</p>
      <h2 class="dp-verdict__title" id="v-title" tabindex="-1">${esc(state === "pending" ? (claim.status === "open" && claim.tier === 0 && txs.assess ? "Too early: the flight hasn't landed yet" : d.headline) : possibly ? "Possibly owed: it depends on the notice you were given" : unless ? "Owed, unless the airline proves extraordinary circumstances" : k.title)}</h2>
      ${amount ? `<p class="dp-verdict__amount"><span class="dp-sr-only">${esc(amount)}</span>${[...amount].map((ch, i) => `<span class="tile" style="animation-delay:${i * 90}ms" aria-hidden="true">${esc(ch)}</span>`).join("")}</p><p class="dp-verdict__per">${possibly ? "at most, " : ""}per passenger · claim #${esc(claim.id)} · ${esc(tierName(claim.tier))}</p>` : `<p class="dp-verdict__per">Claim #${esc(claim.id)} · ${esc(tierName(claim.tier))}</p>`}
      ${state === "paid" ? `<p class="paidwarn" role="note">TEST MODE · NOT A REAL PAYMENT. Paid by the demo payer.</p>` : ""}
      <p class="dp-verdict__body">${esc(verdictBody(claim, state, votes))}</p>
      <div class="dp-verdict__actions">
        <a class="dp-btn dp-btn--primary" href="#proof">${icon("verified-seal")} Get my proof card</a>
        ${letter ? `<a class="dp-btn" href="#letter">${icon("letter")} Claim letter</a>` : ""}
        ${canAssess ? `<button class="dp-btn" id="reassess" type="button">Check again</button>` : ""}
        ${canAppeal ? `<button class="dp-btn" id="appeal" type="button">${icon("appeal")} Appeal to ${claim.tier === 1 ? 3 : 5} analysts</button>` : ""}
        ${canWithdraw ? `<button class="dp-btn" id="withdraw" type="button">${icon("payout")} Collect test payout</button>` : ""}
      </div>
      <div class="dp-verdict__foot">
        ${votes.length ? `<div class="dp-validators"><div class="dp-dots" aria-hidden="true">${votes.map((v) => `<i class="dp-dot ${v === "agree" ? "is-agree" : v === "disagree" ? "is-disagree" : ""}"></i>`).join("")}</div><span class="dp-validators__label">Validators: ${esc(tallyText(votes))}${claim.status === "final" ? " · final" : " · open to appeal"}</span></div>` : ""}
        ${txs.assess ? `<p class="dp-hint dp-mono txline">Deciding tx <code title="${esc(txs.assess)}">${esc(txs.assess.slice(0, 10))}…${esc(txs.assess.slice(-6))}</code>${txs.votes ? ` · ${esc(txs.votes)}` : ""}</p>` : ""}
        <p class="dp-honesty">Information, not legal advice. Airlines aren't legally bound by this ruling.${sample ? " Sample: made-up flight, not a real ruling." : ""}</p>
      </div>
    </article>

    <div class="dp-ticket">
      <div class="dp-ticket__main">
        <div class="dp-cluster" style="justify-content:space-between">
          <span class="dp-label-caps">Flight ${esc(claim.flight)} · ${esc(claim.date)}</span>
          ${rec.status === "CANCELLED" ? `<span class="dp-chip dp-chip--late">Cancelled</span>` : hm(rec.delay_min) ? `<span class="dp-chip dp-chip--late">${esc(hm(rec.delay_min))} at the gate (record)</span>` : ""}
        </div>
        <div class="dp-route">
          <div><span class="dp-route__code">${esc(route.origin || "···")}</span><span class="dp-route__city">${esc(conflict ? "route disputed" : route.origin_country || "")}</span></div>
          <div class="dp-route__line" aria-hidden="true"></div>
          <div><span class="dp-route__code">${esc(route.dest || "···")}</span><span class="dp-route__city">${esc(route.dest_country || "")}</span></div>
        </div>
        <dl class="dp-facts dp-facts--4">
          <div><dt>Status</dt><dd>${esc((rec.status ?? "n/a").toLowerCase().replace("_", " "))}</dd></div>
          <div><dt>Agreed delay</dt><dd${rec.bucket && rec.bucket !== "NONE" ? ' class="dp-late-figure"' : ""}>${esc(rec.status === "CANCELLED" ? "cancelled: no arrival" : rec.bucket === "NONE" ? "not established" : BUCKET_TEXT[rec.bucket] ?? "n/a")}</dd></div>
          <div><dt>Distance</dt><dd>${r.distance_km > 0 && !conflict ? `${Number(r.distance_km).toLocaleString("en-GB")} km` : "n/a"}</dd></div>
          <div><dt>Rule</dt><dd>${esc(conflict ? "n/a" : r.regime || "n/a")}</dd></div>
        </dl>
      </div>
      <div class="dp-ticket__stub"><dl class="dp-facts"><div><dt>Cause found</dt><dd>${esc(CAUSE_TEXT[rec.cause_class] ?? "n/a")}${rec.cause_label && rec.cause_label !== "not stated" ? ` (${esc(rec.cause_label)})` : ""}</dd></div><div><dt>Ruling</dt><dd class="dp-mono">#${esc(claim.id)} · ${esc(claim.status)}</dd></div></dl></div>
    </div>

    <section class="dp-card cardwrap" id="proof" aria-labelledby="proof-h">
      <h2 class="dp-h3" id="proof-h">Your proof card</h2>
      <div class="cardsvg">${card.svg}</div>
      <div class="actions">
        <button class="dp-btn dp-btn--primary" id="dlcard" type="button">${icon("share")} Save as image</button>
        <button class="dp-btn" id="share" type="button">Copy link to this ruling</button>
      </div>
      <p class="dp-hint">The card shows the flight, date and outcome. Never your name or booking reference.</p>
    </section>

    ${canEvidence || canFinalize || (mine && windowOpen && claim.status === "assessed") ? `<section class="dp-card" aria-labelledby="more-h"><h2 class="dp-h3" id="more-h">Next steps</h2>
      ${canEvidence ? `<form id="evform" class="dp-stack"><label class="dp-label" for="evadd">Add a public evidence link (e.g. your airline's delay notice or a news story)</label><input class="dp-input" id="evadd" type="url" placeholder="https://…"><button class="dp-btn" type="submit">Add evidence</button><p class="dp-hint">Then appeal, so a bigger panel reads it.</p></form>` : ""}
      ${mine && windowOpen && claim.status === "assessed" ? `<p class="dp-hint">You can lock this ruling after ${esc(new Date(windowEnds).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}. Until then a payer covering the claim or the airline's registered address can still appeal.</p>` : ""}
      ${canFinalize ? `<p class="dp-hint">Happy with the ruling? Making it final closes appeals${Number(claim.pool_id) > 0 ? (claim.approved ? " and lets you collect the test payout if it's owed" : "; the test payout also needs the payer's approval, which it hasn't given yet") : ""}.</p><button class="dp-btn" id="finalize" type="button">Make this ruling final</button>` : ""}
    </section>` : ""}

    ${letter ? `<details class="dp-card letter" id="letter"><summary>Your claim letter</summary><label class="dp-sr-only" for="lettertext">Claim letter</label><textarea class="dp-textarea" id="lettertext" rows="16">${esc(letter)}</textarea><button class="dp-btn" id="copyletter" type="button">${icon("letter")} Copy letter</button></details>` : ""}

    <details class="dp-card how-decided"><summary>How this was decided</summary>
      <p>Each validator hosted by GenLayer fetched these sources itself and ran ${Number(claim.analysts)} timing and ${Number(claim.analysts)} cause analyst pass${claim.analysts > 1 ? "es" : ""}. Arrival times come only from the flight-status page; attached pages can only inform the cause. The ruling exists only because the validators agreed on the flight status, the arrival delay (within 15 minutes), the cause (${esc(CAUSE_TEXT[rec.cause_class] ?? "n/a")}) and the resulting outcome and amount.</p>
      ${conflict ? `<p>The route database and the flight-status page disagreed about the airports (${esc(rec.route?.origin ?? "?")}-${esc(rec.route?.dest ?? "?")} vs ${esc(rec.seen_route ?? "?")}), so the contract did not use either.</p>` : ""}
      <ul class="src">${sources}</ul><ul>${analysts}</ul>
      ${history ? `<p>Earlier rulings on this claim:</p><ul>${history}</ul>` : ""}
      ${rec.reason ? `<p class="quote">“${esc(rec.reason)}”</p>` : ""}
      ${txs.assess ? `<p class="dp-hint">Deciding tx <code>${esc(txs.assess)}</code>${txs.votes ? ` · validators: ${esc(txs.votes)}` : ""}. Check it yourself: <code>gen_getTransactionByHash</code> on studionet, or read <code>get_claim(${esc(claim.id)})</code> on the contract.</p>` : ""}
      <p class="dp-hint">Rules: ${esc(r.rule_set || "n/a")} · ${esc(r.rules_version || "")}</p>
    </details>`;

  $("share")?.addEventListener("click", () => {
    copy(`${location.href.split("?")[0]}?claim=${claim.id}${txs.assess ? `&tx=${txs.assess}` : ""}`, "share");
    if (!sample) { stamp(wallet, "helped-friend"); saveWallet(); }
  });
  $("dlcard")?.addEventListener("click", () => savePng(card.svg, `delayproof-claim-${claim.id}.png`));
  $("copyletter")?.addEventListener("click", () => copy($("lettertext").value, "copyletter"));
  $("reassess")?.addEventListener("click", () => runWrite("assess", [BigInt(claim.id)], "Checking again", claim.id, true));
  $("appeal")?.addEventListener("click", () => runWrite("appeal", [BigInt(claim.id)], `Appeal to ${claim.tier === 1 ? 3 : 5} analysts`, claim.id, true));
  $("finalize")?.addEventListener("click", () => runWrite("finalize", [BigInt(claim.id)], "Making the ruling final", claim.id, false));
  $("withdraw")?.addEventListener("click", () => runWrite("withdraw_payout", [BigInt(claim.id)], "Collecting the test payout", claim.id, false));
  $("evform")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("evadd").value.trim();
    const chk = checkInputs({ flight: claim.flight, date: claim.date, evidence: [u] });
    if (!u || !chk.ok) { toast("Evidence must be a public https link.", "error"); return; }
    runWrite("add_evidence", [BigInt(claim.id), "claimant", JSON.stringify([u])], "Adding evidence", claim.id, false);
  });
  if (!sample) { wallet = addTrip(wallet, claim, { mine }); saveWallet(); }
  if (!sample && txs.assess && history.replaceState) history.replaceState(null, "", `?claim=${claim.id}&tx=${txs.assess}`);
  return state;
}

async function copy(text, id) {
  try { await navigator.clipboard.writeText(text); $(id).textContent = "Copied"; toast("Copied to your clipboard.", "success"); } catch { $(id).textContent = "Copy failed: select and copy"; }
}

/** Rasterise the proof-card SVG to a 1080x1350 PNG, then share or download it. */
export async function svgToPngBlob(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
    const cv = document.createElement("canvas");
    cv.width = 1080; cv.height = 1350;
    cv.getContext("2d").drawImage(img, 0, 0, 1080, 1350);
    return await new Promise((ok) => cv.toBlob(ok, "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
async function savePng(svg, name) {
  try {
    const blob = await svgToPngBlob(svg);
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "My DelayProof ruling" }); return; }
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    toast("Proof card saved.", "success");
  } catch { toast("Couldn't make the image in this browser. Take a screenshot of the card instead.", "error"); }
}
window.__dpSvgToPngBlob = svgToPngBlob;

// ------------------------------------------------------------------ flows
async function send(fn, args, step, label) {
  rail(step, `${label}: signing in your browser…`);
  const c = await writer();
  const hash = await c.writeContract({ address: C.CONTRACT_ADDRESS, functionName: fn, args, value: 0n });
  rail(step === "open" ? "open" : "fetch", `${label}: sent (${hash.slice(0, 10)}…)`);
  const { c: cls, tx } = await follow(hash, (s) => {
    if (step !== "open" && (s.chainStatus === "PROPOSING" || s.chainStatus === "PENDING")) rail("fetch", "Pulling the public flight record…");
    if (["COMMITTING", "REVEALING"].includes(s.chainStatus)) rail("agree", "Comparing what each validator found…");
    if (s.finality === "ACCEPTED") rail(step === "open" ? "open" : "final", `${label}: accepted; waiting for it to be final (${hash.slice(0, 10)}…)`);
  });
  if (cls.execution === "ERROR" || cls.finality === "FINALIZED_ERROR") throw new Error(revertReason(tx) || `${label} was refused by the contract.`);
  return { hash, tx };
}

async function submit(ev) {
  ev.preventDefault();
  $("formerr").textContent = "";
  const evidence = [...document.querySelectorAll(".evurl")].map((i) => i.value.trim()).filter(Boolean);
  const check = checkInputs({ flight: $("flight").value, date: $("date").value, note: $("note").value.trim(), evidence });
  if (!$("consent").checked) check.errors.push("Please tick the box to confirm your flight, date and note will be public.");
  if (check.errors.length) { $("formerr").textContent = check.errors.join(" "); return; }
  if (SAMPLE_MODE) { $("formerr").textContent = "This is a sample page. Open the home page to check a real flight."; return; }
  if (!LIVE) { $("formerr").textContent = "This build is not connected to a deployed contract yet."; return; }
  $("go").disabled = true;
  $("boardflight").textContent = `${check.flight} · ${$("date").value}`;
  $("checking").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  try {
    await send("open_claim", [check.flight, $("date").value, $("note").value.trim(), evidence.length ? JSON.stringify(evidence) : "", $("pool").checked ? 1n : 0n], "open", "Opening your claim");
    let id = null;
    for (const c of await readContract("list_recent", [20n])) {
      if (c.claimant?.toLowerCase() === me() && c.flight === check.flight && c.date === $("date").value && c.status === "open") { id = c.id; break; }
    }
    if (id === null) throw new Error("Your claim was recorded, but it isn't in the recent list yet. Check Recent rulings in a minute.");
    history.replaceState(null, "", `?claim=${id}`);
    const { hash, tx } = await send("assess", [BigInt(id)], "fetch", "Asking the validators");
    const votes = voteDots(tx);
    showDots(votes);
    rail("final", "Final. Reading the ruling back from the contract…");
    const claim = await readClaim(id);
    rail("done", claim.status === "open" ? "Final: the flight hasn't landed yet, so nothing was ruled." : "Final: the ruling is stored on-chain (still open to appeal).");
    renderResult(claim, { txs: { assess: hash, votes: voteSummary(tx) }, votes });
    $("result").scrollIntoView({ block: "start" });
    $("v-title")?.focus({ preventScroll: true });
    loadRecent();
  } catch (e) {
    rail("agree", String(e.message ?? e).slice(0, 240), true);
  } finally { $("go").disabled = false; }
}

async function runWrite(fn, args, label, id, decides) {
  for (const b of $("result").querySelectorAll("button")) b.disabled = true;
  try {
    const { hash, tx } = await send(fn, args, decides ? "fetch" : "final", label);
    const votes = decides ? voteDots(tx) : current.votes;
    if (decides) showDots(votes);
    rail("done", `${label}: final.`);
    renderResult(await readClaim(id), { txs: decides ? { assess: hash, votes: voteSummary(tx) } : current.txs, votes });
    toast(`${label}: done.`, "success");
  } catch (e) {
    rail(decides ? "agree" : "final", String(e.message ?? e).slice(0, 240), true);
    toast(String(e.message ?? e).slice(0, 160), "error");
    for (const b of $("result").querySelectorAll("button")) b.disabled = false;
  }
}

// ------------------------------------------------------------------ wallet, recent, contract
const CHIP = { owed: ["owed", "Owed"], halved: ["owed", "Owed (halved)"], "appeal-upheld": ["appeal", "Won on appeal"], paid: ["owed", "Paid (test mode)"], review: ["review", "Closer look"], "not-found": ["review", "No record found"], "not-owed": ["plain", "Not owed"], pending: ["review", "Not assessed"] };
function renderWallet() {
  const trips = tripsNewestFirst(wallet);
  const t = totals(wallet);
  $("wallettotal").textContent = t ? `Ruled owed: ${t}` : "";
  $("wallet").innerHTML = trips.length ? trips.map((tr) => {
    const [cls, label] = CHIP[tr.state] ?? CHIP.pending;
    return `<li><a class="trip" href="?claim=${encodeURIComponent(Number(tr.id))}"><span><b>${esc(tr.flight)}</b> ${esc(tr.date)}${tr.mine ? "" : " · viewed"}</span><span class="dp-chip dp-chip--${cls}">${esc(label)}${tr.amount ? ` · ${esc(money(tr.amount, tr.currency))}` : ""}</span></a></li>`;
  }).join("") : `<li class="dp-hint">No trips yet. Check a flight above and it'll appear here.</li>`;
  $("stamps").innerHTML = STAMPS.map((s) => `<li class="stamp${wallet.stamps[s.id] ? " is-earned" : ""}"><b>${esc(s.label)}</b>${esc(wallet.stamps[s.id] ? "Earned" : s.hint)}</li>`).join("");
}

async function loadRecent() {
  if (!LIVE) { $("recentnote").textContent = "Not connected to a deployed contract in this build."; return; }
  try {
    const list = await readContract("list_recent", [10n]);
    $("recent").innerHTML = list.map((c) => {
      const [cls, label] = CHIP[cardState(c)] ?? CHIP.pending;
      return `<li><a href="?claim=${Number(c.id)}"><span><b>#${esc(c.id)} ${esc(c.flight)}</b> ${esc(c.date)}</span><span class="dp-chip dp-chip--${cls}">${esc(label)}</span></a></li>`;
    }).join("") || `<li class="dp-hint">No claims yet.</li>`;
  } catch { $("recentnote").textContent = "Couldn't reach the network. Try again in a moment."; }
}

async function loadContract() {
  const rows = [["Network", C.NETWORK_LABEL], ["Contract", LIVE ? C.CONTRACT_ADDRESS : "not deployed in this build"]];
  if (LIVE) {
    try {
      const cfg = await readContract("get_config", []);
      rows.push(["Rules", cfg.rules_version], ["Analysts per tier", Object.values(cfg.tier_analysts).join(" → ")], ["Challenge window", `${cfg.challenge_minutes} min`], ["Claims so far", String(cfg.next_claim - 1)]);
    } catch { rows.push(["Status", "network unreachable right now"]); }
  }
  $("contract").innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
}

// ------------------------------------------------------------------ boot
$("form").addEventListener("submit", submit);
$("date").max = new Date().toISOString().slice(0, 10);
renderWallet();
{
  const box = $("samplepreview");
  if (box && SAMPLES.owed) box.innerHTML = proofCardSVG(SAMPLES.owed, { votes: SAMPLE_VOTES, sample: true }).svg;
}
// A shared ruling or a sample goes first: the result is moved above the hero and the art is hidden.
function resultFirst() {
  document.body.classList.add("has-result");
  $("main").prepend($("result"));
}
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
async function loadShared(id, txHash) {
  resultFirst();
  $("result").hidden = false;
  $("result").innerHTML = `<p class="dp-hint">Loading claim #${esc(id)} from the contract…</p>`;
  try {
    const claim = await readClaim(id);
    let txs = {}, votes = [];
    if (txHash && TX_RE.test(txHash)) {
      try {
        const tx = await (await reader()).getTransaction({ hash: txHash });
        const to = String(plain(tx)?.to_address ?? plain(tx)?.recipient ?? "").toLowerCase();
        if (!to || to === C.CONTRACT_ADDRESS.toLowerCase()) { votes = voteDots(tx); txs = { assess: txHash, votes: voteSummary(tx) }; }
      } catch { /* show the claim without votes */ }
    }
    renderResult(claim, { txs, votes });
  } catch { $("result").innerHTML = ""; $("result").hidden = true; toast("Couldn't load that claim from the network.", "error"); }
}
if (SAMPLE_MODE) {
  $("samplebar").hidden = false;
  if (SAMPLE === "checking") {
    $("boardflight").textContent = "XX123 · 2026-10-12 (sample)";
    rail("agree", "Sample: this is what the wait looks like.");
    showDots(["agree", "agree", "agree"]);
  } else if (SAMPLES[SAMPLE]) {
    resultFirst();
    renderResult(SAMPLES[SAMPLE], { votes: SAMPLE_VOTES, sample: true });
  }
} else {
  const q = params.get("claim");
  if (q && /^\d+$/.test(q) && LIVE) loadShared(q, params.get("tx"));
}
// Reads start after first paint; genlayer-js arrives as a separate chunk.
const later = window.requestIdleCallback ?? ((f) => setTimeout(f, 200));
later(() => { loadRecent(); loadContract(); });
