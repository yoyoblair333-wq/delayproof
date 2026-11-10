# Milestone: DelayProof v4, payouts that actually arrive

Delta from **v3** (the accepted version, `0x0f68cF95e2E735D0b2AbD8a55de6890D2c0eBfe1`,
commit `2850b13` and earlier) to **v4** (`0xa9bc7c88319649273292E432685C51121b44Af61`).

## The problem v4 fixes

On GenLayer studionet a value transfer from a contract to a plain wallet address (EOA)
is debited from the contract but never credited: the triggered transfer ends
NO_MAJORITY in `contract_not_found_handler` with `value_credited: false`. Both live v3/v2
payouts hit this (`0xe15fd21f…aeff`, `0x79550c58…c0eb`): the pool dropped by €250 worth of
test GEN, the claimant's balance stayed at 10 GEN. Contract-to-contract transfers *are*
credited (shown live by the sister project PriceCourt's AgentWallet run).

## What changed

### Contract `contracts/delay_proof.py` (v3 → v4)

| | v3 | v4 |
|---|---|---|
| Payout destination | always `claimant` (EOA) | the claimant's registered payout wallet contract, else `claimant` (v3 behaviour) |
| New write | - | `set_payout_wallet(wallet)`: the caller sets or clears (`""`) **their own** entry; refuses malformed, zero, own-key and this-contract addresses; blocked while paused |
| New view | - | `get_payout_wallet(claimant) -> str` |
| Claim storage | - | `paid_to`: the address a paid claim's payout was actually sent to (frozen at payout) |
| `get_claim` / `list_recent` | - | `paid_to`, `payout_to` (where an unpaid claim would be paid now; equals `paid_to` once paid) |
| `withdraw_payout` return | `{claim_id, pool_id, amount}` | adds `to` |
| `get_config` | - | `contract_version: "v4"`, `payout_wallets: true` |

Design choice: the registry is **per claimant address**, not per claim, so one wallet
covers every trip and nobody but the claimant can point their payouts anywhere. The
payer, the airline respondent and the owner can only set their own entries (tests:
`test_payer_cannot_redirect_payout`, `test_owner_cannot_redirect_payout`). The contract
does not call the wallet to check its owner (no cross-contract read in the payout path);
the web app checks `get_info().owner` before registering a wallet it deployed. Everything
else (rulings, consensus, appeals, challenge window, reservations, pool reclaim) is
unchanged; `withdraw_pool` still pays the payer's address.

### New contract `contracts/claim_wallet.py` (ClaimWallet)

A minimal payout wallet adapted from PriceCourt's AgentWallet, without arbitrary contract
calls: the deployer is the owner; anyone can `deposit`; only the owner can `send(to,
amount)`, `withdraw(amount)` (to the owner key) or `transfer_ownership`; `get_info`
returns owner, balance, total sent. genvm-lint check + typecheck clean.

### Web app (`web/`, still static)

- **My trips → Payout wallet**: shows the registered wallet (explorer link), whether its
  owner is this browser's key, and the **balance received**, read live
  (`get_payout_wallet`, the wallet's `get_info`, `eth_getBalance`). "Set up my payout
  wallet" deploys a ClaimWallet from the browser's testnet key (source bundled from
  `contracts/claim_wallet.py`, loaded lazily), checks its owner, then calls
  `set_payout_wallet`.
- Collect button says where the payout will go; without a wallet it warns that studionet
  won't credit the key. A paid claim names the wallet it was paid to.
- `config.js` points at v4 (address, code digest for `rig.html`, explorer URL); the
  contract panel shows the version.

### Tests and tooling

- `tests/direct/test_v4_payout_wallet.py`: 34 new direct-mode tests. They capture the
  emitted transfer message through gltest's cross-contract hook, so they assert the
  payout's **destination and value**, not just the pool accounting: register/change/clear,
  per-caller isolation, bad addresses, pause, payout lands in the wallet, v3 fallback,
  frozen `paid_to`, payer/owner can't redirect, two claims to one wallet, pool reclaim
  unchanged, and ClaimWallet owner-only moves and guards.
  Contract suite: **374 passed** (340 before; all v3 tests unchanged and passing).
- Web offline tests: **33** (30 before): GEN formatting and wallet detection, the
  wallet panel with a mocked registered wallet and balance, and the no-wallet warning.
- `scripts/verify.sh` lints ClaimWallet too. `scripts/v4_live.py`: resumable live run
  with fresh throwaway keys kept in git-ignored `.keys/`.

## Live proof (studionet, 2026-11-10)

Full flow on v4 with fresh test keys: deploy, claimant deploys its ClaimWallet and
registers it, payer creates a 2 GEN pool, claimant opens **Ryanair FR1104 Palma →
Manchester, 2026-11-09** (FlightStats: arrived 3h 5m late), validators agree **OWED unless
extraordinary circumstances, €400** (EU261, medium band), payer approves, claimant
finalizes after the 10-minute window and withdraws. The triggered transfer to the wallet
is credited and the wallet's on-chain balance goes **0 → 0.4 GEN**. Every hash and the
before/after balances: [docs/LIVE_EVIDENCE.md](docs/LIVE_EVIDENCE.md#current-deployment-contract-v4-payouts-that-actually-arrive-2026-11-10).

Honest notes: FR1029 (the v3 flight) was retried first and correctly came back
INSUFFICIENT_DATA because FlightStats no longer serves that date (claim #1 on v4). v4
was deployed by a throwaway key with a 10-minute window, not by the owner's wallet.
