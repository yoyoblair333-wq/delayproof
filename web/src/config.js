// The deployment this page talks to. Filled from docs/live/run-1.json after the
// studionet evidence run (scripts keep these in step; see README).
export const NETWORK = "studionet";
export const NETWORK_LABEL = "GenLayer testnet (studionet) · no real money · information, not legal advice";
export const RPC_URL = "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
/** sha256 of contracts/delay_proof.py (LF, one final newline) = canonical digest of the deployed code. */
export const CONTRACT_CODE_DIGEST = "";
export const RAW_SOURCE_URL = "";
export const BURNER_KEY = "delayproof.testnet-burner.v1";
export const POLL_MS = 4000;
export const TX_TIMEOUT_MS = 20 * 60 * 1000;
export const SITE_URL = "";
