// Build the static site into web/dist/ (esbuild bundles genlayer-js for the browser).
import { build } from "esbuild";
import { copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(web, "dist");
await rm(dist, { recursive: true, force: true }); // no stale chunks from earlier builds
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(web, "src/app.js"), path.join(web, "src/rig.js")],
  outdir: dist, entryNames: "[name]", chunkNames: "chunks/[name]-[hash]", splitting: true,
  bundle: true, format: "esm", platform: "browser", target: ["es2022"], minify: true, sourcemap: false,
  legalComments: "linked", logLevel: "warning",
});
for (const f of ["index.html", "rig.html", "review.html", "styles.css"]) await copyFile(path.join(web, "src", f), path.join(dist, f));
for (const d of ["design", "assets"]) await cp(path.join(web, "src", d), path.join(dist, d), { recursive: true });
await copyFile(path.join(web, "src/assets/logo.svg"), path.join(dist, "favicon.svg"));
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("built", dist);
