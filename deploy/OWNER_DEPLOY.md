# Deploy DelayProof from your own wallet (GenLayer Studio)

Same steps as the VERDICT owner deploys on 2026-10-31. About 5 minutes. Your wallet becomes
the owner (creator); the relayer key keeps running claims.

1. Open https://github.com/yoyoblair333-wq/delayproof/blob/main/contracts/delay_proof.py
   (once the repo exists) and click **Copy raw file**.
2. In GenLayer Studio (studio.genlayer.com), with MetaMask connected on the GenLayer Studio
   network, click the **new file** icon next to "Your Contracts".
3. Click inside the editor, press **Ctrl+A**, then **Ctrl+V**.
4. Click **Run and Debug**.
5. In **relayer**, paste `0x34653Fb290480a8C99B4D92D4857123B5624c37d`.
6. Click **Deploy**, then **Confirm** in MetaMask.
7. Tell Claude "deployed". Claude finds the address from your wallet's transactions, checks
   `get_config` (owner = your wallet, relayer = the address above), re-runs
   `tools/live_run.mjs` against it, and points `web/src/config.js` at it.

The stored code will have Windows line endings if pasted on Windows; the code check
normalises line endings, so it still matches the source.
