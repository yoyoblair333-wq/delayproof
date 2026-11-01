// Offline tier: pure helpers + the built pages in headless Chromium with every
// network request to the RPC blocked. No studionet access needed.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe as describeClaim, claimLetter, checkInputs, money } from "../src/lib/ruling.js";
import { canonical } from "../src/lib/digest.js";
import { cardState, voteDots, hm } from "../src/lib/ruling.js";
import { proofCardSVG } from "../src/lib/card.js";
import { addTrip, emptyWallet, totals, tripsNewestFirst } from "../src/lib/wallet.js";
import { SAMPLES } from "../src/lib/samples.js";
import { readCallData, encodeCalldata, decodeCalldata } from "../src/lib/rpc.js";
import { routeStatus, prettyDate, windowText } from "../src/lib/ruling.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../dist");

const claim = (outcome, extra = {}) => ({
  id: 7, flight: "BA117", date: "2026-10-30", status: "assessed", tier: 1, analysts: 1,
  record: { status: "LANDED", bucket: "H4_PLUS", delay_min: 250, cause_class: "UNKNOWN", cause_label: "not stated",
    route: { origin: "LHR", dest: "JFK" }, seen_route: "LHR-JFK", sources: [{ name: "flightstats", ok: true }], analysts: [{ status: "LANDED", delay_min: 250, cause_class: "UNKNOWN" }] },
  ruling: { outcome, regime: "UK261", amount: 520, currency: "GBP", distance_km: 5540, rule_set: "UK261", rules_version: "v1", explanation: "x", flags: [], ...extra },
});

test("money formats EUR and GBP", () => {
  assert.equal(money(600, "EUR"), "€600");
  assert.equal(money(520, "GBP"), "£520");
  assert.equal(money(0, "EUR"), "");
});

test("describe: owed-unless headline, amount and route", () => {
  const d = describeClaim(claim("OWED_UNLESS_EXTRAORDINARY"));
  assert.match(d.headline, /unless the airline proves/);
  assert.equal(d.amount, "£520");
  assert.ok(d.lines[0].includes("LHR → JFK") && d.lines[0].includes("5,540 km"));
});

test("describe: unassessed claim", () => {
  assert.match(describeClaim({ id: 1 }).headline, /Waiting/);
});

test("letter only for payable outcomes, and cites the on-chain record", () => {
  const l = claimLetter(claim("OWED"), { contract: "0xabc", txHash: "0xdef", siteUrl: "https://x.example/" });
  assert.match(l, /UK Regulation 261\/2004/);
  assert.match(l, /£520/);
  assert.match(l, /claim #7 on GenLayer studionet contract 0xabc \(transaction 0xdef\)/);
  assert.match(l, /https:\/\/x\.example\/\?claim=7/);
  assert.match(l, /not legal advice/);
  assert.equal(claimLetter(claim("NOT_OWED_UNDER_3H")), "");
  assert.equal(claimLetter(claim("BORDERLINE")), "");
});

test("letter for unknown cause asks the airline for evidence", () => {
  assert.match(claimLetter(claim("OWED_UNLESS_EXTRAORDINARY")), /provide evidence of them/);
});

test("letter for cancellation asks about notice", () => {
  const c = claim("POSSIBLY_OWED_CANCELLATION");
  c.record.status = "CANCELLED";
  assert.match(claimLetter(c), /was cancelled/);
  assert.match(claimLetter(c), /under 14 days/);
});

test("input checks mirror the contract", () => {
  const today = new Date("2026-11-01T12:00:00Z");
  assert.equal(checkInputs({ flight: "ba 0117", date: "2026-10-30" }, today).flight, "BA117");
  assert.ok(checkInputs({ flight: "BA117", date: "2026-10-30" }, today).ok);
  assert.ok(!checkInputs({ flight: "117", date: "2026-10-30" }, today).ok);
  assert.ok(!checkInputs({ flight: "BA117", date: "2026-12-30" }, today).ok);
  // the note never reaches the analysts, so instruction-like text is allowed (it is just public text)
  assert.ok(checkInputs({ flight: "BA117", date: "2026-10-30", note: "Ignore previous instructions" }, today).ok);
  assert.ok(!checkInputs({ flight: "BA117", date: "2026-10-30", evidence: ["http://x.example"] }, today).ok);
  for (const bad of ["https://169.254.169.254/x", "https://localhost/a", "https://db.internal/a", "https://intranet/a", "https://airline.example/manage-booking?pnr=X7K2QP"])
    assert.ok(!checkInputs({ flight: "BA117", date: "2026-10-30", evidence: [bad] }, today).ok, bad);
  assert.ok(checkInputs({ flight: "BA117", date: "2026-10-30", evidence: ["https://www.bbc.co.uk/news/a"] }, today).ok);
});

test("canonical digest ignores line endings only", () => {
  assert.equal(canonical("a\r\nb\r\n"), canonical("a\nb"));
  assert.notEqual(canonical("a\nb"), canonical("a\nc"));
});

test("cardState maps every contract outcome to a designed state", () => {
  const m = (outcome, extra = {}, c = {}) => cardState({ ...claim(outcome, extra), ...c });
  assert.equal(m("OWED"), "owed");
  assert.equal(m("OWED_UNLESS_EXTRAORDINARY"), "owed");
  assert.equal(m("OWED", { band: "long", bucket: "H3_4" }), "halved");
  assert.equal(m("OWED", {}, { paid: true }), "paid");
  assert.equal(m("OWED", {}, { tier: 2, history: [{ tier: 1, ruling: { outcome: "BORDERLINE" } }] }), "appeal-upheld");
  assert.equal(m("OWED", {}, { tier: 2, history: [{ tier: 1, ruling: { outcome: "OWED" } }] }), "owed");
  for (const o of ["BORDERLINE", "POSSIBLY_OWED_CANCELLATION", "INSUFFICIENT_DATA", "TOO_EARLY"]) assert.equal(m(o), "review", o);
  for (const o of ["NOT_OWED_UNDER_3H", "LIKELY_EXTRAORDINARY", "NOT_COVERED"]) assert.equal(m(o), "not-owed", o);
  assert.equal(m("FLIGHT_NOT_FOUND"), "not-found", "no record is not the same as not owed");
  assert.equal(cardState({ id: 1 }), "pending");
});

test("describe has plain headlines for every outcome the contract emits", () => {
  for (const o of ["OWED", "OWED_UNLESS_EXTRAORDINARY", "POSSIBLY_OWED_CANCELLATION", "BORDERLINE", "NOT_OWED_UNDER_3H", "LIKELY_EXTRAORDINARY", "NOT_COVERED", "TOO_EARLY", "FLIGHT_NOT_FOUND", "INSUFFICIENT_DATA"]) {
    assert.notEqual(describeClaim(claim(o)).headline, o, o);
  }
});

test("vote dots and durations come from the real tx", () => {
  assert.deepEqual(voteDots({ consensus_data: { votes: { a: "idle", b: "agree", c: "agree", d: "disagree" } } }), ["agree", "agree", "disagree", "idle"]);
  assert.deepEqual(voteDots(null), []);
  assert.equal(hm(227), "3h 47m");
  assert.equal(hm(-1), "");
});

test("proof card: honest wording, real tallies, test watermark on payouts", () => {
  const owed = proofCardSVG(claim("OWED"), { votes: ["agree", "agree", "agree", "idle", "idle"], contract: "0x76b28bDC23C86CFB9AE80b3f29643482Aed4BC45" });
  assert.equal(owed.state, "owed");
  assert.match(owed.svg, /agree 3, idle 2/);
  assert.ok(owed.svg.includes(">£</text>"));
  assert.match(owed.svg, /not legal advice/);
  assert.match(owed.svg, /aren't/);
  assert.doesNotMatch(owed.svg, /VERIFIED|of 5 validators|UPHELD|proven|court/i);
  assert.match(owed.svg, /4h\+ late \(agreed\)/);
  const paid = proofCardSVG({ ...claim("OWED"), paid: true, status: "final" });
  assert.match(paid.svg, /TEST · NOT A REAL PAYMENT/);
  const appeal = proofCardSVG({ ...claim("OWED"), tier: 2, history: [{ tier: 1, ruling: { outcome: "BORDERLINE" } }] });
  assert.match(appeal.svg, /CHANGED ON APPEAL/);
  assert.match(proofCardSVG(claim("OWED_UNLESS_EXTRAORDINARY")).svg, /unless the airline proves/);
  assert.match(proofCardSVG(claim("NOT_OWED_UNDER_3H")).svg, /Not owed this time/);
  assert.match(proofCardSVG(SAMPLES.owed, { sample: true }).svg, /SAMPLE/);
  // every legal line is at least 28px on the 1080 card
  for (const m of owed.svg.matchAll(/font-size="(\d+)"[^>]*>[^<]*(?:legal advice|legally bound)/g)) assert.ok(Number(m[1]) >= 28, m[0]);
});

test("proof card: no false facts (R1 quality #4)", () => {
  // diverted / delay unknown is never "On time"
  const div = claim("INSUFFICIENT_DATA", { flags: ["route_conflict"], regime: "EU261", amount: 0, currency: "", distance_km: 788 });
  div.record = { ...div.record, status: "DIVERTED", bucket: "NONE", delay_min: -1, route: { origin: "ZRH", dest: "LHR" }, seen_route: "LCA-LHR" };
  const card = proofCardSVG(div).svg;
  assert.doesNotMatch(card, /On time/);
  assert.match(card, /Diverted/);
  // the route the contract rejected is never shown, nor its distance
  assert.doesNotMatch(card, /ZRH|788 km/);
  assert.doesNotMatch(describeClaim(div).lines[0], /ZRH/);
  // 3h+ landed is never "On time"; landed with no delay figure says so
  const unknown = claim("INSUFFICIENT_DATA");
  unknown.record = { ...unknown.record, bucket: "NONE", delay_min: -1 };
  assert.match(proofCardSVG(unknown).svg, /Arrival delay not established/);
  // currency follows the regime, even when the amount is zero
  const eu = claim("NOT_OWED_UNDER_3H", { regime: "EU261", currency: "", amount: 0 });
  assert.ok(proofCardSVG(eu).svg.includes(">€</text>"));
  const uk = claim("NOT_OWED_UNDER_3H", { regime: "UK261", currency: "", amount: 0 });
  assert.ok(proofCardSVG(uk).svg.includes(">£</text>"));
  // FLIGHT_NOT_FOUND is not "Not owed"
  const nf = proofCardSVG(claim("FLIGHT_NOT_FOUND", { regime: "", amount: 0, currency: "" })).svg;
  assert.doesNotMatch(nf, /Not owed/);
  assert.match(nf, /No record found/);
  // POSSIBLY_OWED shows its maximum
  const c = claim("POSSIBLY_OWED_CANCELLATION");
  c.record.status = "CANCELLED";
  const pc = proofCardSVG(c).svg;
  assert.match(pc, /Possibly owed, up to/);
  assert.match(pc, /maximum per passenger/);
  assert.ok(pc.includes(">£</text>"));
});

test("claim letter: names the deciding sources, never asserts entitlement", () => {
  const c = claim("OWED");
  c.record.cause_class = "CONTROLLABLE"; c.record.cause_label = "technical fault";
  c.evidence = [{ side: "claimant", url: "https://news.example/a" }];
  const l = claimLetter(c);
  assert.match(l, /may be owed under/);
  assert.doesNotMatch(l, /I am entitled|you owe me|must pay/i);
  assert.match(l, /flight-status page \(FlightStats\)/);
  assert.match(l, /attached pages were not used for timing/);
  assert.match(l, /https:\/\/news\.example\/a/);
  assert.match(l, /Validators hosted by GenLayer/);
  assert.match(claimLetter(claim("OWED_UNLESS_EXTRAORDINARY")), /No public source stated a cause/);
});

test("trip wallet: only this browser's claims count, totals say ruled owed, stamps", () => {
  let w = emptyWallet();
  w = addTrip(w, claim("OWED"), { mine: true, now: new Date("2026-11-01T10:00:00Z") });
  w = addTrip(w, { ...claim("OWED"), id: 8 }, { mine: false, now: new Date("2026-11-01T11:00:00Z") });
  w = addTrip(w, { ...claim("NOT_OWED_UNDER_3H"), id: 9 }, { mine: true, now: new Date("2026-11-01T12:00:00Z") });
  assert.equal(totals(w), "£520");
  assert.deepEqual(tripsNewestFirst(w).map((t) => t.id), [9, 8, 7]);
  assert.ok(w.stamps["first-check"] && w.stamps["first-owed"]);
  assert.ok(!w.stamps["first-appeal"]);
  assert.equal(addTrip(w, { ...claim("OWED"), id: 7 }, { mine: false }).trips[7].mine, true, "mine is sticky");
});

test("public note: blocks emails and booking references", () => {
  const today = new Date("2026-11-01T12:00:00Z");
  assert.ok(!checkInputs({ flight: "BA117", date: "2026-10-30", note: "reach me at jo@example.com" }, today).ok);
  assert.ok(!checkInputs({ flight: "BA117", date: "2026-10-30", note: "booking ref K7X2QP" }, today).ok);
  assert.ok(checkInputs({ flight: "BA117", date: "2026-10-30", note: "4 hours late on BA117, crew said tech fault" }, today).ok);
});

// ---- QUALITY-R2 ----------------------------------------------------------

test("R2 P2-8: fetch reads are byte-identical to genlayer-js readContract", async () => {
  const { abi } = await import("genlayer-js");
  const { calldata, transactions } = abi;
  for (const [fn, args] of [["get_config", []], ["get_claim", [6]], ["list_recent", [10]], ["get_claim_id", ["BA117", "2026-10-30", "0x" + "ab".repeat(20)]], ["x", ["é漢字".repeat(30), -5, true, null]]]) {
    const theirs = transactions.serialize([calldata.encode(calldata.makeCalldataObject(fn, args.map((a) => (typeof a === "number" ? BigInt(a) : a)), undefined)), false]);
    assert.equal(readCallData(fn, args), theirs, fn);
  }
  const v = { a: 1, b: [true, null, "s", -3], z: { y: "é" } };
  assert.deepEqual(decodeCalldata(calldata.encode(v)), v);
  assert.deepEqual([...encodeCalldata(v)], [...calldata.encode(v)]);
});

test("R2 P1-4: a route is shown only when the status page confirmed it (live claim #4 shape)", () => {
  // contract v2's BA707 record: adsbdb said ZRH-LHR, the status page showed no airports
  const ba707 = claim("INSUFFICIENT_DATA", { regime: "EU261", amount: 0, currency: "", distance_km: 788 });
  ba707.record = { ...ba707.record, status: "UNKNOWN", bucket: "NONE", delay_min: -1, route: { origin: "ZRH", dest: "LHR", origin_country: "CH", dest_country: "GB" }, seen_route: "-" };
  assert.equal(routeStatus(ba707), "unconfirmed");
  const card = proofCardSVG(ba707).svg;
  assert.doesNotMatch(card, /ZRH|788 km|EU 261/);
  assert.doesNotMatch(describeClaim(ba707).lines.join(" "), /ZRH|EU261/);
  assert.match(describeClaim(ba707).lines[0], /route not confirmed/);
  assert.equal(routeStatus(claim("OWED")), "confirmed");
  const half = claim("OWED", {}); half.record.seen_route = "-JFK";
  assert.equal(routeStatus(half), "unconfirmed");
});

test("R2: leader-only cause label is not stated as fact in the letter", () => {
  const c = claim("OWED");
  c.record.cause_class = "CONTROLLABLE"; c.record.cause_label = "crew sickness";
  assert.doesNotMatch(claimLetter(c), /crew sickness/);
  assert.doesNotMatch(describeClaim(c).lines.join(" "), /crew sickness/);
});

test("R2 P2-6: halved and appeal-won owed-unless cards say unless", () => {
  const h = claim("OWED_UNLESS_EXTRAORDINARY", { band: "long", bucket: "H3_4", amount: 260 });
  assert.match(proofCardSVG(h).svg, /Owed, unless the airline proves/);
  const a = { ...claim("OWED_UNLESS_EXTRAORDINARY"), tier: 2, history: [{ tier: 1, ruling: { outcome: "BORDERLINE" } }] };
  assert.match(proofCardSVG(a).svg, /Appeal won: owed, unless/);
});

test("R2: dates and the window length are formatted, not hard-coded", () => {
  assert.equal(prettyDate("2026-10-30"), "30 Oct 2026");
  assert.equal(windowText(10), "10 minutes");
  assert.equal(windowText(60), "1 hour");
  assert.equal(windowText(1440), "1 day");
  assert.equal(windowText(undefined), "set by the contract");
});

test("R2: no-amount proof card has no dead gap above the ticket", () => {
  const svg = proofCardSVG(claim("NOT_OWED_UNDER_3H", { amount: 0 })).svg;
  const ys = [...svg.matchAll(/<text x="540" y="(\d+)"[^>]*font-size="28"/g)].map((m) => Number(m[1])).filter((y) => y < 770);
  assert.ok(ys.length && 770 - Math.max(...ys) < 240, `gap ${770 - Math.max(...ys)}`);
});

// ---- browser smoke (network to the RPC blocked) --------------------------
async function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".map": "application/json" };
  const server = createServer(async (req, res) => {
    const p = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
    try { const b = await readFile(p); res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); res.end(b); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

test("pages render offline at phone width without errors", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/studio\.genlayer\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(url);
    await page.waitForSelector("#form");
    assert.match(await page.textContent("h1"), /owed/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 375), true, "no horizontal scroll");
    // form validation without network
    await page.fill("#flight", "117");
    await page.click("#go");
    assert.match(await page.textContent("#formerr"), /Flight should look like BA117/);
    await page.fill("#flight", "BA117");
    await page.fill("#date", "2026-10-30");
    await page.click("#go");
    assert.match(await page.textContent("#formerr"), /tick the box/);
    for (const p of ["review.html", "rig.html"]) {
      await page.goto(url + p);
      assert.ok((await page.textContent("h1")).length > 5);
    }
    // "What a ruling looks like" renders on load (R1 quality #14)
    await page.goto(url);
    assert.ok(await page.locator("#samplepreview svg").count() === 1, "sample preview rendered");
    // CSP meta on every page
    for (const p of ["", "review.html", "rig.html"]) {
      await page.goto(url + p);
      assert.match(await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content"), /script-src 'self'/, p || "home");
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});

test("phone layout: check button above the fold, tap targets >= 24px", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.route(/studio\.genlayer\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(url);
    const go = await page.locator("#go").boundingBox();
    assert.ok(go && go.y + go.height <= 667, `check button bottom at ${go && go.y + go.height}px`);
    const small = await page.evaluate(() => [...document.querySelectorAll(".tabs a, .dp-check input, button, summary")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ e: e.id || e.textContent.trim().slice(0, 20), r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 24 || r.width < 24).map(({ e, r }) => `${e} ${Math.round(r.width)}x${Math.round(r.height)}`));
    assert.deepEqual(small, []);
  } finally { await browser.close(); server.close(); }
});

test("build ships no source maps and loads the signer lazily", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(dist, { recursive: true });
  assert.deepEqual(files.filter((f) => f.endsWith(".map")), []);
  const app = await readFile(path.join(dist, "app.js"), "utf8");
  assert.ok(app.length < 120_000, `app.js is ${app.length} bytes; genlayer-js must be a lazy chunk`);
  assert.match(app, /import\("\.\/chunks\//);
});

const STATES = ["owed", "halved", "review", "not-owed", "appeal-upheld", "paid"];
test("every result state renders from labelled samples, never writes, and exports a PNG", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
    const errors = [];
    const rpc = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/studio\.genlayer\.com/, (r) => { rpc.push(r.request().postData() ?? ""); r.abort(); });
    for (const st of STATES) {
      await page.goto(`${url}?sample=${st}`);
      await page.waitForSelector(`.dp-verdict[data-state="${st}"]`);
      assert.equal(await page.isVisible("#samplebar"), true, `${st}: sample bar`);
      assert.match(await page.textContent(".dp-verdict"), /not legal advice/, st);
      assert.match(await page.textContent(".dp-verdict"), /Sample/, st);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 375), true, `${st}: no horizontal scroll`);
      assert.equal(await page.locator("#appeal, #finalize, #withdraw, #evform, #reassess").count(), 0, `${st}: no write buttons on samples`);
      // the ruling comes first on sample/shared pages
      assert.ok(await page.evaluate(() => document.querySelector("#main").firstElementChild.id === "result"), `${st}: result first`);
      const txt = await page.textContent("#result");
      assert.doesNotMatch(txt, /verified by consensus|5 of 5|upheld|photo|proven/i, st);
    }
    // the amount is real text for screen readers, not only flip tiles
    await page.goto(`${url}?sample=owed`);
    assert.equal(await page.textContent(".dp-verdict__amount .dp-sr-only"), "€400");
    const size = await page.evaluate(async () => (await window.__dpSvgToPngBlob(document.querySelector(".cardsvg").innerHTML)).size);
    assert.ok(size > 20000, `PNG export size ${size}`);
    // the checking board shows the rail and labelled sample dots
    await page.goto(`${url}?sample=checking`);
    assert.equal(await page.isVisible("#checking"), true);
    assert.match(await page.textContent("#dots"), /agree 3/);
    // submitting from a sample page is refused before any network write
    await page.goto(`${url}?sample=owed`);
    await page.fill("#flight", "BA117"); await page.fill("#date", "2026-10-30"); await page.check("#consent");
    await page.click("#go");
    assert.match(await page.textContent("#formerr"), /sample page/);
    assert.ok(!rpc.some((b) => /eth_sendRawTransaction|gen_sendRawTransaction|sendRawTransaction/.test(b)), "no write was attempted");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});

test("R2: shared link keeps &tx= in the URL, shows votes, and a read-only visit never loads genlayer-js", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const chunks = [];
    page.on("request", (r) => { if (/\/chunks\//.test(r.url())) chunks.push(r.url()); });
    const live = claim("OWED_UNLESS_EXTRAORDINARY");
    live.id = 6; live.claimant = "0x" + "11".repeat(20); live.history = []; live.evidence = []; live.pool_id = 0; live.challenge_ends = "2026-11-01T13:00:00Z"; live.status = "assessed";
    const enc = (v) => Buffer.from(encodeCalldata(v)).toString("hex");
    const tx = "0x" + "ab".repeat(32);
    const views = {
      [readCallData("get_claim", [6])]: live,
      [readCallData("list_recent", [10])]: [live],
      [readCallData("get_config", [])]: { challenge_minutes: 10, rules_version: "v", tier_analysts: { 1: 1, 2: 3, 3: 5 }, next_claim: 7 },
      [readCallData("get_pool", [1])]: { active: true, expires_at: "2026-11-03T16:50:17Z" },
    };
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/studio\.genlayer\.com/, (r) => {
      const body = JSON.parse(r.request().postData() ?? "{}");
      let result = null;
      if (body.method === "gen_call") {
        const v = views[body.params[0].data];
        if (v === undefined) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: "execution failed" } }) });
        result = enc(v);
      } else if (body.method === "eth_getTransactionByHash") {
        result = { hash: tx, to_address: "0x6F3dedC893C5769305912AA3fADd095E02FB1FBF", status: "FINALIZED", consensus_data: { votes: { a: "agree", b: "agree", c: "agree", d: "idle", e: "idle" } } };
      }
      return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }) });
    });
    await page.goto(`${url}?claim=6&tx=${tx}`);
    await page.waitForSelector(".dp-verdict");
    assert.match(await page.textContent(".dp-verdict"), /agree 3, idle 2/);
    assert.match(page.url(), new RegExp(`claim=6&tx=${tx}`), "the deciding tx stays in the URL");
    assert.match(await page.textContent(".how-decided"), /Leader's notes, not checked by consensus/);
    await page.waitForFunction(() => /10 minutes/.test(document.querySelector("#contract").textContent));
    assert.match(await page.textContent(".after__list"), /10 minutes/, "window text from the contract");
    await page.waitForTimeout(400);
    // only app.js's small static imports load; the lazy genlayer-js/viem chunks never do
    const app = await readFile(path.join(dist, "app.js"), "utf8");
    const staticChunks = new Set([...app.matchAll(/(?:from|import)\s*"\.\/chunks\/([^"]+)"/g)].map((m) => m[1]));
    const lazy = chunks.map((u) => u.split("/chunks/")[1]).filter((n) => !staticChunks.has(n));
    assert.deepEqual(lazy, [], "no genlayer-js chunk on a read-only visit");
    // My trips now links with the tx
    assert.match(await page.getAttribute("#wallet a", "href"), new RegExp(`&tx=${tx}`));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});

test("R2 P1-9: re-checking a flight this browser already claimed opens that claim, with no write", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const me = "0x" + "22".repeat(20);
    await page.addInitScript((addr) => localStorage.setItem("delayproof.testnet-burner.v1", JSON.stringify({ privateKey: "0x" + "01".repeat(32), address: addr })), me);
    const mine = { ...claim("OWED"), id: 3, claimant: me, status: "assessed", history: [], evidence: [], pool_id: 0 };
    const enc = (v) => Buffer.from(encodeCalldata(v)).toString("hex");
    const methods = [];
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/studio\.genlayer\.com/, (r) => {
      const body = JSON.parse(r.request().postData() ?? "{}");
      methods.push(body.method);
      // the deployed v2 contract has no get_claim_id view, so the app falls back to list_recent
      const views = { [readCallData("list_recent", [50])]: [mine], [readCallData("list_recent", [10])]: [mine], [readCallData("get_claim", [3])]: mine };
      const v = body.method === "gen_call" ? views[body.params[0].data] : undefined;
      if (v === undefined) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: "execution failed" } }) });
      return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: enc(v) }) });
    });
    await page.goto(url);
    await page.fill("#flight", "BA117"); await page.fill("#date", "2026-10-30"); await page.check("#consent");
    assert.match(await page.textContent("#dateecho"), /30 Oct 2026/);
    await page.click("#go");
    await page.waitForSelector('.dp-verdict');
    assert.match(page.url(), /\?claim=3/);
    assert.ok(!methods.some((m) => /sendRawTransaction/.test(m)), "no write was attempted");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); }
});

test("R2 P1-8: a closed demo pool disables the payout option instead of failing the check", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const enc = (v) => Buffer.from(encodeCalldata(v)).toString("hex");
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/studio\.genlayer\.com/, (r) => {
      const body = JSON.parse(r.request().postData() ?? "{}");
      const views = { [readCallData("get_pool", [1])]: { active: true, expires_at: "2026-11-03T16:50:17Z" } };
      const v = body.method === "gen_call" ? views[body.params[0].data] : undefined;
      if (v === undefined) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: "no" } }) });
      return r.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: enc(v) }) });
    });
    // freeze the clock after the pool's expiry
    await page.addInitScript(() => { const T = Date.parse("2026-11-04T00:00:00Z"); const D = Date; Date.now = () => T; });
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector("#poolnote").textContent.length > 0);
    assert.equal(await page.isDisabled("#pool"), true);
    assert.match(await page.textContent("#poolnote"), /closed/);
  } finally { await browser.close(); server.close(); }
});

async function axeScan(page) {
  await page.addScriptTag({ path: path.resolve(here, "../node_modules/axe-core/axe.min.js") });
  const r = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test("WCAG 2.1 AA (axe) at 375px, light and dark", async (t) => {
  let chromium;
  try { ({ chromium } = await import("playwright")); } catch { t.skip("playwright not installed"); return; }
  const { server, url } = await serve();
  const browser = await chromium.launch();
  try {
    for (const colorScheme of ["light", "dark"]) {
      // bypassCSP only so the test can inject axe-core; the CSP itself is asserted above
      const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme, reducedMotion: "reduce", bypassCSP: true });
      const page = await ctx.newPage();
      await page.route(/studio\.genlayer\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      for (const target of ["", "?sample=owed", "?sample=review", "?sample=not-owed", "?sample=paid", "?sample=checking", "review.html", "rig.html"]) {
        await page.goto(url + target);
        await page.waitForTimeout(250);
        assert.deepEqual(await axeScan(page), [], `${colorScheme} ${target || "home"}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
});
