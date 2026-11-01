// Live evidence run for contracts/delay_proof.py on studionet.
// Deploys (or reuses DP_ADDRESS), funds a pool, opens real claims, assesses them
// (validators fetch live flight data), appeals one, finalizes, withdraws from the
// pool if a ruling is payable, and records every tx + final status in OUT.
// Two roles (contract v2): the PAYER key comes from RELAYER_PRIVATE_KEY (never printed)
// and deploys + funds the pool + approves claims; the CLAIMANT is a fresh burner key
// generated per run (testnet only, discarded) so the challenge window applies to it.
// DP_CHALLENGE_MIN sets the deploy's challenge window (default 10 for this throwaway run).
//   set -a; . /home/claude/verdict/relayer/.env.local; set +a
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/live_run.mjs docs/live/run-1.json
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { createAccount, createClient, generatePrivateKey } = await import(path.join(HERE, "node_modules/genlayer-js/dist/index.js"));
const { studionet } = await import(path.join(HERE, "node_modules/genlayer-js/dist/chains/index.js"));

const OUT = process.argv[2] ?? "run.json";
const PLAN = JSON.parse(process.env.DP_PLAN ?? "{}");
const pk = process.env.RELAYER_PRIVATE_KEY;
if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error("RELAYER_PRIVATE_KEY missing");
const account = createAccount(pk);
const payerClient = createClient({ chain: studionet, account });
const claimant = createAccount(generatePrivateKey());
const claimantClient = createClient({ chain: studionet, account: claimant });
const CHALLENGE_MIN = Number(process.env.DP_CHALLENGE_MIN ?? 10);
const client = payerClient;
const RPC = "https://studio.genlayer.com/api";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = () => new Date().toISOString();
const plain = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x instanceof Map ? Object.fromEntries(x) : x)));
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;

const CODE_PATH = path.join(HERE, "../contracts/delay_proof.py");
const code = readFileSync(CODE_PATH, "utf8");
const run = { network: "studionet", startedAt: iso(), deployer: account.address, payer: account.address, claimant: claimant.address,
  challenge_minutes: CHALLENGE_MIN, contract: process.env.DP_ADDRESS ?? null,
  contract_file: "contracts/delay_proof.py", contract_code_sha256: createHash("sha256").update(code).digest("hex"), steps: [] };
const save = () => writeFileSync(OUT, JSON.stringify(plain(run), null, 1) + "\n");

function summarize(tx) {
  const p = plain(tx) ?? {};
  const votes = p?.consensus_data?.votes ?? {};
  const counts = {};
  for (const v of Object.values(votes)) counts[v] = (counts[v] ?? 0) + 1;
  const lr = Array.isArray(p?.consensus_data?.leader_receipt) ? p.consensus_data.leader_receipt[0] : p?.consensus_data?.leader_receipt;
  const s = JSON.stringify(p);
  return { status: p.statusName, result: p.resultName ?? p.result_name ?? null, execution: lr?.execution_result ?? null,
    votes: counts, error: (s.match(/\[(EXPECTED|LLM_ERROR)\][^"\\]*/) || [null])[0] };
}
async function settle(hash, label, until = "FINALIZED", timeoutMs = 1500000) {
  const end = Date.now() + timeoutMs;
  let tx = null, last = "";
  const transitions = [];
  while (Date.now() < end) {
    try { tx = await client.getTransaction({ hash }); } catch { tx = null; }
    const s = tx?.statusName ?? "";
    if (s && s !== last) { transitions.push({ at: iso(), status: s }); console.log(`  ${label}: ${s}`); last = s; }
    if (["FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(s)) break;
    if (until === "ACCEPTED" && s === "ACCEPTED") break;
    await sleep(5000);
  }
  return { tx, transitions };
}
async function write(label, functionName, args, value = 0n, until = "FINALIZED", as = "payer") {
  const step = { label, fn: functionName, args, value: value.toString(), sentAt: iso(), as };
  const c = as === "claimant" ? claimantClient : payerClient;
  try {
    step.tx = await c.writeContract({ address: run.contract, functionName, args, value });
    const { tx, transitions } = await settle(step.tx, label, until);
    step.transitions = transitions;
    step.final = summarize(tx);
  } catch (e) { step.error = String(e?.message ?? e).slice(0, 500); console.log("  error", step.error); }
  run.steps.push(step); save();
  return step;
}
const read = (functionName, args) => client.readContract({ address: run.contract, functionName, args });

// ---- deploy ----
if (!run.contract) {
  const hash = await client.deployContract({ code, args: [BigInt(CHALLENGE_MIN)] });
  const { tx, transitions } = await settle(hash, "deploy");
  run.contract = plain(tx)?.data?.contract_address ?? null;
  run.deploy = { tx: hash, transitions, final: summarize(tx) };
  console.log("deployed", run.contract); save();
}
run.stored_code_sha256 = createHash("sha256").update(Buffer.from((await rpc("gen_getContractCode", [run.contract])) ?? "", "base64")).digest("hex");
run.code_matches = run.stored_code_sha256 === run.contract_code_sha256;
save();

// ---- pool (testnet GEN) ----
let poolId = Number(process.env.DP_POOL_ID ?? 0);
if (process.env.DP_DEPLOY_TX) run.deploy = { tx: process.env.DP_DEPLOY_TX, note: "deployed in an earlier invocation of this script (it crashed on saving afterwards)" };
if (process.env.DP_POOL_TX) run.steps.push({ label: "create_pool (earlier invocation)", fn: "create_pool", tx: process.env.DP_POOL_TX });
if (poolId) run.pool = plain(await read("get_pool", [BigInt(poolId)]));
if (PLAN.pool && !poolId) {
  await rpc("sim_fundAccount", [account.address, PLAN.pool.fund]);
  run.balance_before_pool = await rpc("eth_getBalance", [account.address, "latest"]);
  const s = await write("create_pool", "create_pool", [PLAN.pool.name, PLAN.pool.regime, BigInt(PLAN.pool.rate),
    BigInt(PLAN.pool.days ?? 30), BigInt(PLAN.pool.max_per_flight ?? 1), Boolean(PLAN.pool.owed_only ?? false)], BigInt(PLAN.pool.deposit));
  if (s.final?.execution === "SUCCESS" || s.final?.status === "FINALIZED") {
    poolId = Number((await read("get_config", [])).get?.("next_pool") ?? plain(await read("get_config", [])).next_pool) - 1;
    run.pool = plain(await read("get_pool", [BigInt(poolId)]));
  }
}

// ---- claims (opened, assessed, finalized and withdrawn by the claimant burner) ----
run.claimant_funded = await rpc("sim_fundAccount", [claimant.address, "0x8ac7230489e80000"]).catch((e) => String(e));
const waitWindow = async (claim) => {
  const end = Date.parse(claim?.challenge_ends ?? "");
  if (!Number.isFinite(end)) return;
  const ms = end - Date.now() + 30000;
  if (ms > 0) { console.log(`  waiting ${Math.round(ms / 1000)}s for the challenge window`); await sleep(ms); }
};
for (const c of PLAN.claims ?? []) {
  const before = Number(plain(await read("get_config", [])).next_claim);
  const o = await write(`open ${c.flight} ${c.date}${c.label ? " (" + c.label + ")" : ""}`, "open_claim",
    [c.flight, c.date, c.note ?? "", c.evidence ? JSON.stringify(c.evidence) : "", BigInt(c.pool ? poolId : 0)], 0n, "ACCEPTED", "claimant");
  if (o.final?.error) continue;
  const id = before;
  const a = await write(`assess #${id}`, "assess", [BigInt(id)], 0n, "FINALIZED", "claimant");
  a.claim_id = id;
  const assessed = a.final?.status === "FINALIZED" && a.final?.execution === "SUCCESS";
  if (!assessed) { (run.claims ??= []).push(plain(await read("get_claim", [BigInt(id)]))); save(); console.log(`  claim #${id}: assessment did not finalize with SUCCESS`); continue; }
  if (c.appeal) await write(`appeal #${id}${c.pool ? " (by the payer)" : ""}`, "appeal", [BigInt(id)], 0n, "FINALIZED", c.pool ? "payer" : "claimant");
  if (c.pool && c.approve) await write(`approve #${id} (payer consent)`, "approve_claim", [BigInt(id)]);
  if (c.finalize) {
    if (c.early_finalize_guard) await write(`guard: claimant finalize #${id} inside challenge window`, "finalize", [BigInt(id)], 0n, "ACCEPTED", "claimant");
    await waitWindow(plain(await read("get_claim", [BigInt(id)])));
    await write(`finalize #${id} (claimant, after window)`, "finalize", [BigInt(id)], 0n, "ACCEPTED", "claimant");
  }
  const claim = plain(await read("get_claim", [BigInt(id)]));
  (run.claims ??= []).push(claim); save();
  console.log(`  claim #${id}:`, claim?.ruling?.outcome, claim?.record?.status, claim?.record?.bucket, claim?.record?.cause_class);
  if (c.pool && c.finalize && ["OWED", "OWED_UNLESS_EXTRAORDINARY"].includes(claim?.ruling?.outcome)) {
    const balBefore = await rpc("eth_getBalance", [claimant.address, "latest"]);
    const w = await write(`withdraw #${id}`, "withdraw_payout", [BigInt(id)], 0n, "FINALIZED", "claimant");
    w.balance_before = balBefore;
    await sleep(15000);
    w.balance_after = await rpc("eth_getBalance", [claimant.address, "latest"]);
    run.pool_after = plain(await read("get_pool", [BigInt(poolId)]));
    save();
  }
}

// ---- extra operations on existing claims (e.g. appeal ladder, respondent evidence) ----
for (const op of PLAN.ops ?? []) {
  await write(op.label, op.fn, op.args.map((x) => (x === "$POOL" ? BigInt(poolId) : typeof x === "number" ? BigInt(x) : x)), 0n, op.until ?? "FINALIZED", op.as ?? "payer");
}
for (const id of PLAN.snapshot ?? []) { (run.claims ??= []).push(plain(await read("get_claim", [BigInt(id)]))); save(); }

// ---- guards that must revert ----
for (const g of PLAN.guards ?? []) {
  await write(`guard: ${g.label}`, g.fn, g.args.map((x) => (x === "$POOL" ? BigInt(poolId) : typeof x === "number" ? BigInt(x) : x)), 0n, "ACCEPTED", g.as ?? "payer");
}
run.config = plain(await read("get_config", []));
run.finishedAt = iso(); save();
console.log("done");
