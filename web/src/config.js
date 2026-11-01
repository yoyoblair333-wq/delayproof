// The deployment this page talks to: contract v3, deployed from the owner's wallet on
// studionet (deploy tx 0xa7dd809f…6144, challenge window 60 min). See docs/LIVE_EVIDENCE.md.
export const NETWORK = "studionet";
export const NETWORK_LABEL = "GenLayer testnet (studionet) · no real money · information, not legal advice";
export const RPC_URL = "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = "0x0f68cF95e2E735D0b2AbD8a55de6890D2c0eBfe1";
/** sha256 of contracts/delay_proof.py (LF, one final newline) = canonical digest of the deployed code. */
export const CONTRACT_CODE_DIGEST = "4aaea34660277664bc9b076744f06ff966b5692c5692bfd18aac49c0a53b480b";
export const RAW_SOURCE_URL = "https://raw.githubusercontent.com/yoyoblair333-wq/delayproof/main/contracts/delay_proof.py";
export const BURNER_KEY = "delayproof.testnet-burner.v1";
export const POLL_MS = 4000;
export const TX_TIMEOUT_MS = 20 * 60 * 1000;
export const SITE_URL = "https://yoyoblair333-wq.github.io/delayproof/";
