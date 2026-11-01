// Phase 0 feasibility: deploy contracts/probe.py to studionet (or reuse PROBE_ADDRESS),
// then probe a list of URLs and record what validators saw.
// Key comes from RELAYER_PRIVATE_KEY in the environment and is never printed.
//   set -a; . /home/claude/verdict/relayer/.env.local; set +a
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/probe_live.mjs out.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { createAccount, createClient } = await import(path.join(HERE, "node_modules/genlayer-js/dist/index.js"));
const { studionet } = await import(path.join(HERE, "node_modules/genlayer-js/dist/chains/index.js"));

const out = process.argv[2] ?? "probe-run.json";
const pk = process.env.RELAYER_PRIVATE_KEY;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("RELAYER_PRIVATE_KEY missing");
const account = createAccount(pk);
const client = createClient({ chain: studionet, account });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x instanceof Map ? Object.fromEntries(x) : x)));
const iso = () => new Date().toISOString();

async function settle(hash, label, timeoutMs = 600000) {
  const end = Date.now() + timeoutMs;
  let tx = null, last = "";
  while (Date.now() < end) {
    try { tx = await client.getTransaction({ hash }); } catch { tx = null; }
    const s = tx?.statusName ?? String(tx?.status ?? "");
    if (s !== last) { console.log(`  ${label}: ${s}`); last = s; }
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(s)) break;
    await sleep(4000);
  }
  return tx;
}
function execResult(tx) {
  const p = plain(tx);
  const s = JSON.stringify(p);
  const r = p?.consensus_data?.leader_receipt?.[0] ?? p?.consensus_data?.leader_receipt ?? {};
  return { status: p?.statusName, result: p?.resultName ?? p?.result_name, exec: r?.execution_result ?? null, err: (s.match(/\[(EXPECTED|REJECTED)\][^"\\]*/) || [null])[0] };
}

const run = { network: "studionet", startedAt: iso(), deployer: account.address, address: process.env.PROBE_ADDRESS ?? null, deployTx: null, probes: [] };
const save = () => writeFileSync(out, JSON.stringify(run, null, 1) + "\n");

if (!run.address) {
  const code = readFileSync(path.join(HERE, "../contracts/probe.py"), "utf8");
  const hash = await client.deployContract({ code, args: [] });
  run.deployTx = hash; save();
  console.log("deploy tx", hash);
  const tx = await settle(hash, "deploy");
  run.address = plain(tx)?.data?.contract_address ?? plain(tx)?.to_address ?? null;
  console.log("deploy", execResult(tx), "address", run.address);
  save();
}

const urls = JSON.parse(process.env.PROBE_URLS ?? "[]");
for (const [url, mode] of urls) {
  console.log("probe", mode, url);
  const rec = { url, mode, sentAt: iso(), tx: null, final: null, stored: null };
  try {
    rec.tx = await client.writeContract({ address: run.address, functionName: "probe", args: [url, mode], value: 0n });
    const tx = await settle(rec.tx, "probe");
    rec.final = execResult(tx);
    const n = Number(await client.readContract({ address: run.address, functionName: "get_count", args: [] }));
    rec.stored = await client.readContract({ address: run.address, functionName: "get_probe", args: [String(n - 1)] });
    console.log("  ->", String(rec.stored).slice(0, 220));
  } catch (e) { rec.error = String(e?.message ?? e).slice(0, 400); console.log("  error", rec.error); }
  run.probes.push(rec); save();
}
run.finishedAt = iso(); save();
