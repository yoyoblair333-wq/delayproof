// The deployment this page talks to. Filled from docs/live/run-1.json after the
// studionet evidence run (scripts keep these in step; see README).
export const NETWORK = "studionet";
export const NETWORK_LABEL = "GenLayer testnet (studionet) · no real money · information, not legal advice";
export const RPC_URL = "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = "0xAC6b99E93afa612E50F2E687F8088B5a4289a31f";
/** sha256 of contracts/delay_proof.py (LF, one final newline) = canonical digest of the deployed code. */
export const CONTRACT_CODE_DIGEST = "cbc40d839803c703e02c8c6ccd1bdcfa9cf1f4e3ada5ec5e1187670239136f36";
export const RAW_SOURCE_URL = "https://raw.githubusercontent.com/yoyoblair333-wq/delayproof/main/contracts/delay_proof.py";
export const BURNER_KEY = "delayproof.testnet-burner.v1";
export const POLL_MS = 4000;
export const TX_TIMEOUT_MS = 20 * 60 * 1000;
export const SITE_URL = "https://yoyoblair333-wq.github.io/delayproof/";
