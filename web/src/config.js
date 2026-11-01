// The deployment this page talks to. Filled from docs/live/run-1.json after the
// studionet evidence run (scripts keep these in step; see README).
export const NETWORK = "studionet";
export const NETWORK_LABEL = "GenLayer testnet (studionet) · no real money · information, not legal advice";
export const RPC_URL = "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = "0x6F3dedC893C5769305912AA3fADd095E02FB1FBF";
/** sha256 of contracts/delay_proof.py (LF, one final newline) = canonical digest of the deployed code. */
export const CONTRACT_CODE_DIGEST = "567cfec1688b26aa81d4bab793151b4a22ead3585333e879e521ed37c45bf673";
export const RAW_SOURCE_URL = "https://raw.githubusercontent.com/yoyoblair333-wq/delayproof/main/contracts/delay_proof.py";
export const BURNER_KEY = "delayproof.testnet-burner.v1";
export const POLL_MS = 4000;
export const TX_TIMEOUT_MS = 20 * 60 * 1000;
export const SITE_URL = "https://yoyoblair333-wq.github.io/delayproof/";
