// "Check the code": hashes the code stored on-chain (gen_getContractCode) in this
// browser and compares it with the digest this site was built with and, when a
// public source URL is configured, with the source file itself.
import * as C from "./config.js";
import { canonical, sha256Hex } from "./lib/digest.js";

const $ = (id) => document.getElementById(id);

async function chainCode() {
  const r = await fetch(C.RPC_URL, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_getContractCode", params: [C.CONTRACT_ADDRESS] }) });
  const j = await r.json();
  const bin = atob(j.result ?? "");
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function main() {
  const out = $("rig");
  if (!out) return;
  try {
    const code = await chainCode();
    const chain = await sha256Hex(canonical(code));
    let gh = null;
    if (C.RAW_SOURCE_URL) { try { gh = await sha256Hex(canonical(await (await fetch(C.RAW_SOURCE_URL)).text())); } catch { gh = null; } }
    const pinned = C.CONTRACT_CODE_DIGEST;
    const ok = chain === pinned && (gh === null || gh === chain);
    const msg = !ok ? "MISMATCH: do not trust this deployment." : gh === null
      ? "MATCH with this site's pinned digest. The published source file couldn't be fetched, so it wasn't compared."
      : "MATCH: the deployed code is the published code.";
    out.innerHTML = `<p class="${ok ? "verdict-ok" : "verdict-bad"}">${msg}</p>
      <table><tr><th>Deployed (hashed in your browser)</th><td><code>${chain}</code></td></tr>
      <tr><th>Pinned in this site</th><td><code>${pinned || "(not pinned)"}</code></td></tr>
      ${gh !== null ? `<tr><th>Source file</th><td><code>${gh}</code></td></tr>` : ""}</table>
      <p class="small">Contract <code>${C.CONTRACT_ADDRESS}</code>. Line endings are normalised before hashing because Windows editors change them; that cannot hide a code change.</p>`;
  } catch (e) {
    out.innerHTML = `<p class="verdict-bad">Couldn't reach the network to check: ${String(e.message ?? e).slice(0, 120).replace(/[&<>"']/g, "")}</p>`;
  }
}
main();
