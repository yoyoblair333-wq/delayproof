// Live tier: the built page in headless Chromium against studionet. The browser
// makes its own burner, signs open_claim + assess, follows them to agreement and
// reads the ruling back. Writes a record to ../docs/live/browser-run.json.
//   cd web && npm run build && NODE_USE_ENV_PROXY=1 node test/live.test.mjs [FLIGHT] [DATE]
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../dist");
const [flight = "BA117", date = "2026-10-31"] = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".map": "application/json" };
const server = createServer(async (req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
  try { const b = await readFile(p); res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" } : undefined;
const browser = await chromium.launch({ proxy });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
const log = [];
page.on("console", (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => log.push(`[pageerror] ${e}`));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const t0 = Date.now();
let ok = false;
const out = { flight, date, startedAt: new Date().toISOString() };
try {
  await page.goto(url);
  await page.fill("#flight", flight);
  await page.fill("#date", date);
  await page.check("#consent");
  await page.click("#go");
  const rail = [];
  const poll = setInterval(async () => { try { const n = await page.textContent("#railnote"); if (n && rail.at(-1) !== n) rail.push(n); } catch {} }, 1000);
  await page.waitForSelector("#proofcard", { timeout: 25 * 60 * 1000 });
  clearInterval(poll);
  out.rail = rail;
  out.headline = await page.textContent("#card-h");
  out.card = await page.textContent("#proofcard");
  out.claimUrl = page.url().replace(url, "<site>/");
  out.howDecided = await page.textContent(".how-decided");
  out.letter = (await page.$("#lettertext")) ? await page.inputValue("#lettertext") : null;
  await page.screenshot({ path: path.join(here, "../../docs/live/browser-run.png"), fullPage: true });
  ok = true;
} catch (e) {
  out.error = String(e).slice(0, 400);
  try { out.railnote = await page.textContent("#railnote"); } catch {}
} finally {
  out.seconds = Math.round((Date.now() - t0) / 1000);
  out.console = log.slice(-30);
  await writeFile(path.join(here, "../../docs/live/browser-run.json"), JSON.stringify(out, null, 1) + "\n");
  await browser.close();
  server.close();
}
console.log(ok ? `PASS ${out.headline} (${out.seconds}s)` : `FAIL ${out.error}`);
process.exit(ok ? 0 : 1);
