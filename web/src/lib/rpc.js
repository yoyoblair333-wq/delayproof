// Read-only GenLayer calls over plain fetch JSON-RPC, so a visitor who only reads
// never downloads genlayer-js/viem (QUALITY-R2 P2-8). The calldata format and the
// RLP framing mirror genlayer-js 1.1.8 (src/abi/calldata, src/abi/transactions);
// test/offline.test.mjs checks the bytes match genlayer-js exactly.

const T_SPECIAL = 0, T_PINT = 1, T_NINT = 2, T_BYTES = 3, T_STR = 4, T_ARR = 5, T_MAP = 6;
const S_NULL = 0, S_FALSE = 8, S_TRUE = 16, S_ADDR = 24;

function uleb(to, n) {
  if (n === 0n) { to.push(0); return; }
  while (n > 0n) {
    let b = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) b |= 0x80;
    to.push(b);
  }
}
const typed = (to, n, t) => uleb(to, (BigInt(n) << 3n) | BigInt(t));
function cmpCodepoints(a, b) {
  for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
function enc(to, v) {
  if (v === null || v === undefined) return void to.push(S_NULL);
  if (v === true) return void to.push(S_TRUE);
  if (v === false) return void to.push(S_FALSE);
  if (typeof v === "number") { if (!Number.isInteger(v)) throw new Error("floats are not supported"); v = BigInt(v); }
  if (typeof v === "bigint") return v >= 0n ? typed(to, v, T_PINT) : typed(to, -v - 1n, T_NINT);
  if (typeof v === "string") { const b = new TextEncoder().encode(v); typed(to, b.length, T_STR); for (const c of b) to.push(c); return; }
  if (v instanceof Uint8Array) { typed(to, v.length, T_BYTES); for (const c of v) to.push(c); return; }
  if (Array.isArray(v)) { typed(to, v.length, T_ARR); for (const x of v) enc(to, x); return; }
  if (typeof v === "object") {
    const entries = Object.entries(v).map(([k, x]) => [Array.from(k, (ch) => ch.codePointAt(0)), new TextEncoder().encode(k), x]);
    entries.sort((a, b) => cmpCodepoints(a[0], b[0]));
    typed(to, entries.length, T_MAP);
    for (const [, kb, x] of entries) { uleb(to, BigInt(kb.length)); for (const c of kb) to.push(c); enc(to, x); }
    return;
  }
  throw new Error("unsupported calldata value");
}
export function encodeCalldata(v) { const a = []; enc(a, v); return new Uint8Array(a); }

function readUleb(d, ix) {
  let res = 0n, shift = 0n, b;
  do { b = d[ix.i++]; res += BigInt(b & 0x7f) << shift; shift += 7n; } while (b >= 0x80);
  return res;
}
const hex = (bytes) => "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
function dec(d, ix) {
  const cur = readUleb(d, ix);
  if (cur === BigInt(S_NULL)) return null;
  if (cur === BigInt(S_TRUE)) return true;
  if (cur === BigInt(S_FALSE)) return false;
  if (cur === BigInt(S_ADDR)) { const a = d.slice(ix.i, ix.i + 20); ix.i += 20; return hex(a); }
  const t = Number(cur & 7n), n = cur >> 3n;
  switch (t) {
    case T_BYTES: { const b = d.slice(ix.i, ix.i + Number(n)); ix.i += Number(n); return hex(b); }
    case T_PINT: return Number(n);
    case T_NINT: return Number(-1n - n);
    case T_STR: { const b = d.slice(ix.i, ix.i + Number(n)); ix.i += Number(n); return new TextDecoder().decode(b); }
    case T_ARR: { const out = []; for (let k = 0n; k < n; k++) out.push(dec(d, ix)); return out; }
    case T_MAP: {
      const out = {};
      for (let k = 0n; k < n; k++) {
        const len = Number(readUleb(d, ix));
        const key = new TextDecoder().decode(d.slice(ix.i, ix.i + len));
        ix.i += len;
        out[key] = dec(d, ix);
      }
      return out;
    }
    default: throw new Error(`can't decode calldata type ${t}`);
  }
}
/** Decode GenVM calldata into plain JSON (ints as Number, addresses/bytes as 0x hex). */
export function decodeCalldata(bytes) {
  const ix = { i: 0 };
  const v = dec(bytes, ix);
  if (ix.i !== bytes.length) throw new Error("some data left");
  return v;
}

// ---- RLP of a list of byte strings (what genlayer-js `serialize` produces)
function rlpLen(to, len, short, long) {
  if (len < 56) { to.push(short + len); return; }
  const lb = [];
  for (let x = len; x > 0; x = Math.floor(x / 256)) lb.unshift(x % 256);
  to.push(long + lb.length, ...lb);
}
function rlpBytes(b) {
  if (b.length === 1 && b[0] < 0x80) return [b[0]];
  const out = [];
  rlpLen(out, b.length, 0x80, 0xb7);
  return out.concat(Array.from(b));
}
export function rlpList(items) {
  const body = items.flatMap(rlpBytes);
  const out = [];
  rlpLen(out, body.length, 0xc0, 0xf7);
  return hex(out.concat(body));
}

/** The `data` field of a gen_call read, byte-identical to genlayer-js readContract. */
export function readCallData(functionName, args = []) {
  const call = { method: functionName };
  if (args.length) call.args = args;
  // genlayer-js serialises [calldata, leaderOnly=false]; viem's toHex(false) is 0x0 -> one 0x00 byte.
  return rlpList([encodeCalldata(call), new Uint8Array([0])]);
}

function fromHex(h) {
  const s = String(h).replace(/^0x/, "");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}

let rpcId = 0;
export async function rpc(url, method, params, fetchImpl = fetch) {
  const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) });
  if (!r.ok) throw new Error(`network error ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? "RPC error");
  return j.result;
}

/** A contract view call (gen_call, type read) without genlayer-js. */
export async function viewCall(url, address, functionName, args = [], fetchImpl = fetch) {
  const result = await rpc(url, "gen_call", [{ type: "read", to: address, from: "0x0000000000000000000000000000000000000000",
    data: readCallData(functionName, args), transaction_hash_variant: "latest-nonfinal" }], fetchImpl);
  let h;
  if (typeof result === "string") h = result;
  else if (result && typeof result === "object" && "data" in result) {
    if (result.status && result.status.code !== 0) throw new Error(`gen_call failed: ${result.status.message}`);
    h = result.data;
  } else throw new Error("unexpected gen_call response");
  return decodeCalldata(fromHex(h));
}

/** A studionet transaction as JSON (status name, consensus votes), without genlayer-js. */
export async function getTx(url, hash, fetchImpl = fetch) {
  const tx = await rpc(url, "eth_getTransactionByHash", [hash], fetchImpl);
  if (tx && typeof tx.status === "string" && !tx.statusName) tx.statusName = tx.status === "ACTIVATED" ? "PENDING" : tx.status;
  return tx;
}
