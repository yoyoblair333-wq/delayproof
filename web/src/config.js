// The deployment this page talks to: contract v4 (payout wallets) on studionet, deployed
// 2026-11-10 by a throwaway test key (deploy tx 0xc409bef5…648a, challenge window 10 min).
// See docs/LIVE_EVIDENCE.md ("v4") and MILESTONE.md. v3 0x0f68cF95…Bfe1 is superseded.
export const NETWORK = "studionet";
export const NETWORK_LABEL = "GenLayer testnet (studionet) · no real money · information, not legal advice";
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const CONTRACT_ADDRESS = "0xa9bc7c88319649273292E432685C51121b44Af61";
/** sha256 of contracts/delay_proof.py (LF, one final newline) = canonical digest of the deployed code. */
export const CONTRACT_CODE_DIGEST = "e12e8e7f72ca3bff1d349031c869bbe45e8a66fcb70c82c2ffaacca77c84b2d0";
export const RAW_SOURCE_URL = "https://raw.githubusercontent.com/yoyoblair333-wq/delayproof/main/contracts/delay_proof.py";
export const BURNER_KEY = "delayproof.testnet-burner.v1";
export const POLL_MS = 4000;
export const TX_TIMEOUT_MS = 20 * 60 * 1000;
export const SITE_URL = "https://yoyoblair333-wq.github.io/delayproof/";
