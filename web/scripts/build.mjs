// Build the static site into web/dist/ (esbuild bundles genlayer-js for the browser).
import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(web, "dist");
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(web, "src/app.js"), path.join(web, "src/rig.js")],
  outdir: dist, entryNames: "[name]", chunkNames: "chunks/[name]-[hash]", splitting: true,
  bundle: true, format: "esm", platform: "browser", target: ["es2022"], minify: true, sourcemap: true,
  legalComments: "linked", logLevel: "warning",
});
for (const f of ["index.html", "rig.html", "review.html", "styles.css"]) await copyFile(path.join(web, "src", f), path.join(dist, f));
await writeFile(path.join(dist, "favicon.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#111418"/><path d="M8 25l9-3 8-13 3 1-4 11 8-3 2 2-9 6-15 3z" fill="#FFB000"/><path d="M27 30l3 3 6-7" stroke="#3DDC84" stroke-width="3" fill="none" stroke-linecap="round"/></svg>');
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("built", dist);
