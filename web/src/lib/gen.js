// Testnet GEN amounts: base units (wei, 18 decimals) as BigInt -> short text.
export function fmtGen(wei) {
  let v;
  try { v = BigInt(wei ?? 0); } catch { return "n/a"; }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toLocaleString("en-GB")}${frac ? "." + frac : ""} GEN`;
}
export const shortAddr = (a) => (/^0x[0-9a-fA-F]{40}$/.test(a ?? "") ? `${a.slice(0, 8)}…${a.slice(-4)}` : String(a ?? ""));
/** True when a v4 claim's payout went (or will go) to a payout wallet rather than the claimant's key. */
export function paysToWallet(claim, field = "payout_to") {
  const to = String(claim?.[field] ?? "").toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(to) && to !== String(claim?.claimant ?? "").toLowerCase();
}
