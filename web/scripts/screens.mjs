// Render every UI state to docs/screens/ (light/dark, 390 and 1280 wide).
// Serves web/dist locally and blocks the RPC, so only the labelled ?sample=
// states and the offline home page are shown. Usage: node scripts/screens.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(web, "dist");
const out = path.resolve(web, "../docs/screens");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".map": "application/json" };
const server = createServer(async (req, res) => {
  const p = path.join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
  try { const b = await readFile(p); res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
await mkdir(out, { recursive: true });
const states = (process.env.STATES ?? "home,checking,owed,halved,review,not-owed,appeal-upheld,paid,review-page,rig-page").split(",");
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) for (const width of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: width === 390 ? 2 : 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.route(/studio\.genlayer\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  for (const s of states) {
    const target = s === "home" ? url : s === "review-page" ? url + "review.html" : s === "rig-page" ? url + "rig.html" : `${url}?sample=${s}`;
    await page.goto(target);
    await page.waitForTimeout(600);
    if (!["home", "review-page", "rig-page", "checking"].includes(s)) await page.locator("#result").scrollIntoViewIfNeeded();
    const file = path.join(out, `${s}-${scheme}-${width}.png`);
    const full = ["home", "review-page", "rig-page"].includes(s);
    if (full) await page.screenshot({ path: file, fullPage: true });
    if (!["home", "review-page", "rig-page"].includes(s)) await page.locator(s === "checking" ? "#checking" : "#result").screenshot({ path: file.replace(".png", "-focus.png") });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(file, overflow ? "OVERFLOW" : "ok");
  }
  await ctx.close();
}
await browser.close();
server.close();
