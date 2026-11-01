// Trip Wallet + stamps: kept only in this browser (localStorage), never on-chain,
// never money. Pure functions over a plain object so they can be unit-tested;
// app.js handles the storage I/O inside try/catch.
import { cardState, money, PAYABLE } from "./ruling.js";

export const WALLET_KEY = "delayproof.wallet.v1";
export const STAMPS = [
  { id: "first-check", label: "First check", hint: "Checked a flight with the network" },
  { id: "first-owed", label: "First owed", hint: "A ruling said owed" },
  { id: "first-appeal", label: "Appeal won", hint: "A bigger panel changed a ruling to owed" },
  { id: "helped-friend", label: "Helped a friend", hint: "Shared a ruling link" },
];

export function emptyWallet() { return { v: 1, trips: {}, stamps: {} }; }

/** Record (or refresh) a real claim this browser opened or viewed. */
export function addTrip(wallet, claim, { mine = false, now = new Date(), tx = "" } = {}) {
  const w = structuredClone(wallet ?? emptyWallet());
  if (!claim || claim.id === undefined) return w;
  const prev = w.trips[claim.id] ?? {};
  const r = claim.ruling ?? {};
  w.trips[claim.id] = {
    id: claim.id, flight: claim.flight, date: claim.date,
    state: cardState(claim), outcome: r.outcome ?? "", amount: PAYABLE.has(r.outcome) ? Number(r.amount) || 0 : 0,
    currency: r.currency ?? "", mine: prev.mine || mine, seen: now.toISOString(),
    // the deciding tx, so My trips links can show the votes again (kept while the tier is unchanged)
    tx: /^0x[0-9a-fA-F]{64}$/.test(tx) ? tx : prev.tier === claim.tier ? prev.tx ?? "" : "", tier: claim.tier,
  };
  if (w.trips[claim.id].mine) {
    stamp(w, "first-check", now);
    if (PAYABLE.has(r.outcome)) stamp(w, "first-owed", now);
    if (w.trips[claim.id].state === "appeal-upheld") stamp(w, "first-appeal", now);
  }
  return w;
}

export function stamp(w, id, now = new Date()) {
  if (!w.stamps[id]) w.stamps[id] = now.toISOString();
  return w;
}

/** "Ruled owed" totals per currency, for trips this browser opened. Never a balance. */
export function totals(wallet) {
  const t = {};
  for (const trip of Object.values(wallet?.trips ?? {})) {
    if (!trip.mine || !trip.amount || !trip.currency) continue;
    t[trip.currency] = (t[trip.currency] ?? 0) + trip.amount;
  }
  return Object.entries(t).map(([c, a]) => money(a, c)).join(" + ");
}

export function tripsNewestFirst(wallet) {
  return Object.values(wallet?.trips ?? {}).sort((a, b) => String(b.seen).localeCompare(String(a.seen)));
}
