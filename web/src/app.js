// DelayProof web app: opens a claim, asks the validators to assess it, follows
// the transaction to finality and shows the agreed ruling, a proof card and a
// claim letter. Every write is signed in this browser by a testnet burner key.
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import * as C from "./config.js";
import { classifyTx, voteSummary, revertReason } from "./lib/finality.js";
import { describe, claimLetter, tierName, checkInputs, BUCKET_TEXT, CAUSE_TEXT } from "./lib/ruling.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x instanceof Map ? Object.fromEntries(x) : x)));

const reader = createClient({ chain: studionet });
const LIVE = /^0x[0-9a-fA-F]{40}$/.test(C.CONTRACT_ADDRESS) && !/^0x0+$/.test(C.CONTRACT_ADDRESS);

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? "null");
    localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
  return value;
}
let account = null;
function signer() {
  if (account) return account;
  let b = store(C.BURNER_KEY);
  if (!b?.privateKey) { b = { privateKey: generatePrivateKey(), note: "studionet testnet only, holds nothing of value" }; store(C.BURNER_KEY, b); }
  account = createAccount(b.privateKey);
  return account;
}
const writer = () => createClient({ chain: studionet, account: signer() });

async function readClaim(id) { return plain(await reader.readContract({ address: C.CONTRACT_ADDRESS, functionName: "get_claim", args: [BigInt(id)] })); }

// ------------------------------------------------------------------ status rail
const STEPS = ["open", "fetch", "agree", "final"];
function rail(step, note = "", failed = false) {
  $("progress").hidden = false;
  const i = step === "done" ? STEPS.length : STEPS.indexOf(step);
  for (const li of $("progress").querySelectorAll("li")) {
    const j = STEPS.indexOf(li.dataset.step);
    li.className = j < i ? "done" : j === i ? (failed ? "fail" : "now") : "";
  }
  $("railnote").textContent = note;
}

async function follow(hash, onState) {
  const end = Date.now() + C.TX_TIMEOUT_MS;
  let last = "";
  while (Date.now() < end) {
    let tx = null;
    try { tx = await reader.getTransaction({ hash }); } catch { /* not indexed yet */ }
    const c = classifyTx(tx);
    if (c.chainStatus !== last) { last = c.chainStatus; onState?.(c, tx); }
    if (c.finality === "FINALIZED_SUCCESS" || c.finality === "FINALIZED_ERROR" || c.finality === "ACCEPTED") return { c, tx };
    await sleep(C.POLL_MS);
  }
  throw new Error("The network is slow. Your claim is saved; check back from Recent rulings.");
}

// ------------------------------------------------------------------ result view
function renderResult(claim, txs = {}) {
  const d = describe(claim);
  const rec = claim.record ?? {};
  const sources = (rec.sources ?? []).map((s) => `<li class="${s.ok ? "ok" : "bad"}">${esc(s.name)}: ${s.ok ? "loaded" : "failed"}</li>`).join("");
  const analysts = (rec.analysts ?? []).map((a, i) => `<li>Analyst ${i + 1}: ${esc(a.status)}${a.delay_min >= 0 ? `, ${a.delay_min} min` : ""}, ${esc(a.cause_class)}</li>`).join("");
  const letter = claimLetter(claim, { contract: C.CONTRACT_ADDRESS, txHash: txs.assess, siteUrl: C.SITE_URL || location.href.split("?")[0] });
  const canAppeal = claim.status === "assessed" && claim.tier < 3;
  $("result").hidden = false;
  $("result").innerHTML = `
    <article class="card tone-${d.tone}" id="proofcard" aria-labelledby="card-h">
      <p class="card-kicker">DELAYPROOF RULING · CLAIM #${claim.id} · ${esc(tierName(claim.tier).toUpperCase())}</p>
      <h2 id="card-h">${esc(d.headline)}</h2>
      ${d.amount ? `<p class="amount">${esc(d.amount)}<small> per passenger</small></p>` : ""}
      <ul class="facts">${d.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      ${claim.ruling?.flags?.length ? `<p class="flag">Check: ${claim.ruling.flags.map(esc).join(", ")}</p>` : ""}
      <p class="stamp">${claim.status === "final" ? "FINAL" : "AGREED BY VALIDATORS"}</p>
      <p class="small">Airlines are not bound by this ruling. Information, not legal advice.</p>
    </article>
    <details class="how-decided" open><summary>How this was decided</summary>
      <p>Each GenLayer validator fetched these sources itself and ran ${claim.analysts} analyst pass${claim.analysts > 1 ? "es" : ""}. The ruling exists only because they agreed on the same flight status, delay band (${esc(BUCKET_TEXT[rec.bucket] ?? "n/a")}) and cause (${esc(CAUSE_TEXT[rec.cause_class] ?? "n/a")}).</p>
      <ul class="src">${sources}</ul><ul class="src">${analysts}</ul>
      ${rec.reason ? `<p class="quote">“${esc(rec.reason)}”</p>` : ""}
      ${txs.assess ? `<p class="small">Assessment tx <code>${esc(txs.assess)}</code>${txs.votes ? ` · validators: ${esc(txs.votes)}` : ""}</p>` : ""}
      <p class="small">Rules: ${esc(claim.ruling?.rule_set || "n/a")} · ${esc(claim.ruling?.rules_version)}</p>
    </details>
    <div class="actions">
      ${canAppeal ? `<button class="btn2" id="appeal">Appeal to ${claim.tier === 1 ? "3" : "5"} analysts</button>` : ""}
      <button class="btn2" id="share">Copy link to this ruling</button>
    </div>
    ${letter ? `<details class="letter" open><summary>Your claim letter</summary><textarea id="lettertext" rows="16" aria-label="Claim letter">${esc(letter)}</textarea><button class="btn2" id="copyletter">Copy letter</button></details>` : ""}`;
  $("share")?.addEventListener("click", () => copy(`${location.href.split("?")[0]}?claim=${claim.id}`, "share"));
  $("copyletter")?.addEventListener("click", () => copy($("lettertext").value, "copyletter"));
  $("appeal")?.addEventListener("click", () => runAppeal(claim));
}
async function copy(text, id) {
  try { await navigator.clipboard.writeText(text); $(id).textContent = "Copied"; } catch { $(id).textContent = "Copy failed: select and copy"; }
}

// ------------------------------------------------------------------ flows
async function send(fn, args, step, label) {
  const c = writer();
  rail(step, `${label}: signing in your browser…`);
  const hash = await c.writeContract({ address: C.CONTRACT_ADDRESS, functionName: fn, args, value: 0n });
  rail(step === "open" ? "open" : "fetch", `${label}: sent (${hash.slice(0, 10)}…)`);
  const { c: cls, tx } = await follow(hash, (s) => {
    if (step !== "open" && (s.chainStatus === "PROPOSING" || s.chainStatus === "PENDING")) rail("fetch", "Validators are fetching the flight record and reading it…");
    if (["COMMITTING", "REVEALING"].includes(s.chainStatus)) rail("agree", "Validators are comparing what they found…");
  });
  if (cls.execution === "ERROR" || cls.finality === "FINALIZED_ERROR") throw new Error(revertReason(tx) || `${label} was refused by the contract.`);
  return { hash, tx };
}

async function submit(ev) {
  ev.preventDefault();
  $("formerr").textContent = "";
  const evidence = [...document.querySelectorAll(".evurl")].map((i) => i.value.trim()).filter(Boolean);
  const check = checkInputs({ flight: $("flight").value, date: $("date").value, note: $("note").value.trim(), evidence });
  if (!$("consent").checked) check.errors.push("Please tick the box to confirm this is a public testnet record.");
  if (check.errors.length) { $("formerr").textContent = check.errors.join(" "); return; }
  if (!LIVE) { $("formerr").textContent = "This build is not connected to a deployed contract yet."; return; }
  $("go").disabled = true;
  try {
    const before = Number(plain(await reader.readContract({ address: C.CONTRACT_ADDRESS, functionName: "get_config", args: [] })).next_claim);
    await send("open_claim", [check.flight, $("date").value, $("note").value.trim(), evidence.length ? JSON.stringify(evidence) : "", 0n], "open", "Opening your claim");
    // Find our claim id: the newest claim by this burner with this flight+date.
    let id = before;
    for (const c of plain(await reader.readContract({ address: C.CONTRACT_ADDRESS, functionName: "list_recent", args: [20n] }))) {
      if (c.claimant?.toLowerCase() === signer().address.toLowerCase() && c.flight === check.flight && c.date === $("date").value && c.status === "open") { id = c.id; break; }
    }
    history.replaceState(null, "", `?claim=${id}`);
    const { hash, tx } = await send("assess", [BigInt(id)], "fetch", "Asking the validators");
    rail("final", "Agreed. Reading the ruling back from the contract…");
    const claim = await readClaim(id);
    renderResult(claim, { assess: hash, votes: voteSummary(tx) });
    rail("done", "Done: the ruling below is stored on-chain.");
    loadRecent();
  } catch (e) {
    rail("agree", String(e.message ?? e).slice(0, 240), true);
  } finally { $("go").disabled = false; }
}

async function runAppeal(claim) {
  const btn = $("appeal");
  btn.disabled = true;
  try {
    const { hash, tx } = await send("appeal", [BigInt(claim.id)], "fetch", `Appeal to ${claim.tier === 1 ? 3 : 5} analysts`);
    renderResult(await readClaim(claim.id), { assess: hash, votes: voteSummary(tx) });
    rail("done", "Appeal decided.");
  } catch (e) {
    rail("agree", String(e.message ?? e).slice(0, 240), true);
    btn.disabled = false;
  }
}

async function loadRecent() {
  if (!LIVE) { $("recentnote").textContent = "Not connected to a deployed contract in this build."; return; }
  try {
    const list = plain(await reader.readContract({ address: C.CONTRACT_ADDRESS, functionName: "list_recent", args: [10n] }));
    $("recent").innerHTML = list.map((c) => {
      const d = describe(c);
      return `<li><a href="?claim=${c.id}"><b>#${c.id} ${esc(c.flight)}</b> ${esc(c.date)} · <span class="tone-${d.tone}">${esc(c.ruling ? d.headline : "not assessed yet")}</span></a></li>`;
    }).join("") || "<li>No claims yet.</li>";
  } catch { $("recentnote").textContent = "Couldn't reach the network. Try again in a moment."; }
}

async function loadContract() {
  const rows = [["Network", C.NETWORK_LABEL], ["Contract", LIVE ? C.CONTRACT_ADDRESS : "not deployed in this build"]];
  if (LIVE) {
    try {
      const cfg = plain(await reader.readContract({ address: C.CONTRACT_ADDRESS, functionName: "get_config", args: [] }));
      rows.push(["Rules", cfg.rules_version], ["Analysts per tier", Object.values(cfg.tier_analysts).join(" → ")], ["Claims so far", String(cfg.next_claim - 1)]);
    } catch { rows.push(["Status", "network unreachable right now"]); }
  }
  $("contract").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
}

$("form").addEventListener("submit", submit);
$("date").max = new Date().toISOString().slice(0, 10);
const q = new URLSearchParams(location.search).get("claim");
if (q && /^\d+$/.test(q) && LIVE) readClaim(q).then((c) => renderResult(c)).catch(() => {});
loadRecent();
loadContract();
