# ClaimCheck: a k-of-n web-evidence quorum oracle

`contracts/claim_check.py` is a standalone GenLayer Intelligent Contract that other contracts
and apps call to settle one question: **do these web pages, read independently by every
validator, back this claim, and do at least k of them agree?**

- Source: [`contracts/claim_check.py`](../contracts/claim_check.py) (GenVM v0.2.16 Python SDK)
- Example consumer: [`contracts/claim_check_consumer.py`](../contracts/claim_check_consumer.py)
- Tests: [`tests/direct/test_claim_check.py`](../tests/direct/test_claim_check.py) (110 direct-mode tests)
- Live run: [`docs/live/claim-check-run.json`](live/claim-check-run.json), made by
  [`scripts/claim_check_live.mjs`](../scripts/claim_check_live.mjs)
- Usage examples: [`examples/claim-check/README.md`](../examples/claim-check/README.md)
- Deployed (studionet): see [Live deployment](#live-deployment)

## What a caller does

```
check(claim, sources, k, required_quote_hint="") -> record
```

| Input | Rule |
|---|---|
| `claim` | 10 to 280 characters after cleanup, no injection phrases |
| `sources` | 1 to 5 `https://` URLs, each on a **different host** (`www.` ignored) |
| `k` | 1 to `len(sources)`: how many sources must agree |
| `required_quote_hint` | optional, 3 to 120 characters; a source only counts as SUPPORTS if this text is on it |

Every validator fetches every source and labels each one:

| Per-source label | Meaning | Excerpt |
|---|---|---|
| `SUPPORTS` | the page states the claim | required, verbatim, checked against the fetched text |
| `CONTRADICTS` | the page states something incompatible | required, verbatim, checked |
| `SILENT` | readable, but does not settle the claim | none |
| `UNREACHABLE` | fetch error, non-2xx, over 4 MB, not text/HTML, or an error, login or captcha page | none |
| `INJECTED` | the page tries to instruct the checker | none; excluded from the count |

The final verdict is a pure function of the labels and k (`tally` in the source):

| Verdict | Rule (checked in this order) |
|---|---|
| `DISPUTED` | at least one SUPPORTS **and** at least one CONTRADICTS |
| `SUPPORTED` | at least k SUPPORTS |
| `CONTRADICTED` | at least k CONTRADICTS |
| `INSUFFICIENT` | fewer than k usable sources (UNREACHABLE and INJECTED are not usable) |
| `NOT_FOUND` | enough usable sources, but no quorum either way |

DISPUTED comes first on purpose: one credible contradicting source blocks SUPPORTED, so
two copies of one blog post cannot outvote a primary source.

Stored record (`get_check(id)`): `id, claim, hint, k, sources[{url, url_hash, label, excerpt,
excerpt_sha256, detail}], verdict, fingerprint, revision, requester, created_at, checked_at,
history[]`. `detail` gives the reason for each label in machine-readable form (`excerpt_verified`,
`excerpt_not_in_page`, `http_404`, `page_injection_screen`, ...).

Other calls:

| Call | Kind | Purpose |
|---|---|---|
| `recheck(id)` | write, anyone | runs the round again on the stored inputs and records drift |
| `get_check(id)` | view | full record with revision history (newest 10 kept) |
| `get_verdict(id)` | view | compact record for contracts to gate on |
| `find(claim, sources, k, hint)` | view | newest check for exactly these inputs, or `{"id": 0}`; source order and URL case are ignored, k is not |
| `list_recent(n)` | view | newest first, up to 50 |
| `stats()` | view | totals by verdict, recheck and drift counters, limits |
| `set_paused`, `transfer_ownership` | owner | the owner cannot touch records or verdicts |

## How consensus is used

The whole fetch-and-label round runs inside one `gl.vm.run_nondet_unsafe(leader_fn,
validator_fn)` block with a custom validator, the pattern used by `pattern_ledger.py` and
`delay_proof.py`:

1. **The leader** fetches each source (`gl.nondet.web.get`; `text/plain` bodies are used as they
   are, HTML is read with `gl.nondet.web.render(mode="text")`), selects up to 7,500 characters
   per page by a deterministic IDF-weighted chunk ranking against the claim, runs the page
   injection screen, asks its LLM for one label and excerpt **per source**, applies the
   deterministic post-rules, and returns `{verdict, sources[{label, excerpt, detail, prev}]}`.
2. **Each validator** rejects the proposal unless it is well formed (exact key sets, known
   labels, excerpt lengths, no excerpt on non-evidence labels) and its `verdict` equals
   `tally(labels, k)`. Then it runs the same round itself: its own fetches, its own LLM.
3. It votes yes only if:
   - every per-source label equals its own label exactly;
   - every SUPPORTS or CONTRADICTS excerpt from the leader appears, after the shared
     normalisation, in the page text **this validator** fetched;
   - on a recheck, the "is the previous excerpt still on the page" bit (`prev`) matches its own.

If the leader errors, or a validator's own LLM or fetch fails, the validator votes no, which
forces a leader rotation. It never agrees to an error.

**Why the excerpt is verified to exist and not compared.** Two honest validators reading the
same page will often quote different sentences that support the same fact (the date line or
the abstract). Requiring the same excerpt would fail honest rounds and add no safety. What
matters is that the leader cannot invent or import evidence, and checking the excerpt
against each validator's own independent fetch is exactly that test. The stored excerpt is
the leader's; its `excerpt_sha256` is a fingerprint, not a consensus value.

**Shared normalisation** (`norm_for_match`) applies NFKC, strips zero-width and bidi
characters, maps curly quotes and dashes, drops footnote markers such as `[12]` and
`[citation needed]`, collapses whitespace, closes rendered-element gaps (`2818 , 7230`
becomes `2818, 7230`) and casefolds. The same function serves leader, validators and recheck.

## Why this is not an LLM wrapper

- **The LLM never decides the outcome.** It labels one page at a time, and never sees k, the
  other sources or the verdict rules. The verdict comes from a 10-line pure function (`tally`)
  that every validator recomputes, and a leader that misreports it is voted down.
- **Evidence is mechanically checked.** A SUPPORTS or CONTRADICTS label without an excerpt that
  is really on the page is downgraded to SILENT by deterministic code, both in the leader and
  in each validator against its own fetch. The model cannot invent a quote and get it stored.
- **The equivalence check is substantive.** Validators compare every per-source label, recompute
  the tally and verify each excerpt against their own fetch. A format check alone would pass a
  leader that invented its labels.
- **The quorum is protected from Sybil sources.** There is one vote per host, with at most five
  hosts, and a single contradiction produces DISPUTED. Unreachable and injected pages are
  excluded from the count; they are never treated as silent agreement.
- **The state is designed for reuse.** Records have stable ids, a `find()` key binds a result to
  its exact inputs, there are fingerprints and a revision history, and `recheck()` turns a
  one-off answer into something you can monitor over time.
- **Other contracts can compose with it.** `claim_check_consumer.py` requests checks through an
  emitted message and settles by reading `find()` through `view()`. Both are real GenVM
  cross-contract calls, demonstrated on studionet.

## Threat model

| Threat | What happens | Mitigation in the contract | Residual risk |
|---|---|---|---|
| **URL rot** (page moved, deleted, paywalled) | fetch fails or returns an error page | non-2xx, fetch errors, empty pages and error or login pages are `UNREACHABLE` and do not count; `recheck()` records the drift (`label_after: UNREACHABLE`, `old_excerpt: absent`) | a record is a snapshot of when it was checked; consumers that need freshness call `recheck` or compare `checked_at` |
| **Prompt injection in the claim** | caller tries to steer the reader | deterministic phrase screen (the pattern_ledger approach, plus labels used as commands and reply keys) after NFKC and invisible-character stripping; refused inputs revert `[EXPECTED]` | paraphrased injections pass the screen, but the next two layers still apply |
| **Prompt injection in a page** | a cited page tells the model what to answer | page text is fenced with a per-check nonce and the fence markers are defused; a deterministic screen on the text the model would see labels the page `INJECTED` with no LLM call; the model may also return `INJECTED`; INJECTED never counts toward k | an injection subtle enough to pass the screen and fool the model still needs a verbatim excerpt that is really on the page, and it has to beat any contradicting source (DISPUTED) |
| **Volatile pages** (live counters, A/B content, personalised pages) | validators see different text | labels must match exactly and excerpts must be in each validator's own fetch, so disagreement rotates the leader and never stores a split result | very volatile pages may never reach consensus; cite stable primary pages (RFCs, statutes, archived copies) |
| **Spoofing** (fake page, lookalike domain, settling a case with someone else's check) | fake evidence or a mismatched result | `https` only; no credentials, IP literals, localhost, `.local`/`.internal` hosts or non-default ports; every record stores its canonical URL and `url_hash`; consumers bind by `find(claim, sources, k)`, so a check for a different claim, source set or lower k cannot settle their case | ClaimCheck shows what a page says, not who controls the domain; picking trustworthy hosts is the caller's policy (for example an allowlist in the consumer) |
| **Cherry-picking** (choosing only the sources that agree, or one site several times) | weak quorum | one vote per host; DISPUTED on any conflict; k is part of the `find()` key and the record, so consumers can demand k of at least 2; `required_quote_hint` lets a consumer insist on a specific passage | a caller can still omit contradicting sources; consumers who care should fix the source list themselves (as the example consumer stores it at `open_case`) |
| **Model hallucination** | invented quote or misread number | excerpt existence check in leader and validators; downgrade to SILENT | a model can mislabel a real quote, but every validator's own model has to make the same mistake for the label to pass consensus |
| **Cost griefing** | large pages or many checks | 4 MB fetch cap, 7,500 characters of context per source, at most 5 sources, owner pause; each check is paid by its caller | no per-caller rate limit (deliberately simple) |

## Honest scope and limits

- It reports **what pages say**, not what is true. A SUPPORTED verdict means k independent hosts
  stated the claim when they were checked, and that every validator verified the excerpts
  against its own fetch.
- **JavaScript-heavy pages** are read through `render(mode="text")`. Pages behind logins or
  bot walls are UNREACHABLE.
- **Retrieval is bounded**: 7,500 characters per page, chosen by deterministic IDF-weighted
  chunk ranking. A fact in a long page can be missed, and the page is then SILENT. This
  happened live (#1 below: a 75k-character Wikipedia article came back NOT_FOUND), and
  `required_quote_hint` fixed it (#13). A miss makes the result conservative; it never
  produces a false SUPPORTED.
- **The page injection screen is heuristic.** An article about prompt injection that quotes
  "ignore previous instructions" in the selected text is labelled INJECTED (a safe false
  positive: it only removes a vote).
- **Excerpts are capped** at 300 characters after normalisation.
- **Cross-contract results are asynchronous.** `emit()` creates a separate ClaimCheck
  transaction after the caller's transaction is accepted, so a consumer reads the result in a
  later call through `view().find(...)`, as the example does.
- **Studionet only so far**, deployed by the existing deployer key, with Blair's wallet passed as
  `owner`.

## Calling it from another contract

```python
from genlayer import *

class MyDispute(gl.Contract):
    claim_check: Address

    @gl.public.write
    def ask(self, claim: str, sources: list[str], k: int) -> None:
        # Asynchronous: runs as its own ClaimCheck transaction after this one is accepted.
        gl.get_contract_at(self.claim_check).emit(on="accepted").check(claim, sources, k, "")

    @gl.public.write
    def resolve(self, claim: str, sources: list[str], k: int) -> str:
        # Synchronous read of ClaimCheck state, bound to the exact inputs.
        v = gl.get_contract_at(self.claim_check).view().find(claim, sources, k, "")
        if v["id"] == 0:
            raise gl.vm.UserError("[EXPECTED] not checked yet")
        return v["verdict"]   # SUPPORTED | CONTRADICTED | DISPUTED | NOT_FOUND | INSUFFICIENT
```

`contracts/claim_check_consumer.py` is the complete, tested version: `open_case`, then
`request_check` (emit), then `settle` (view + find). Only SUPPORTED and CONTRADICTED settle a
case; any other verdict keeps it open for a later check or recheck. Cross-contract calls must
stay outside non-deterministic blocks (GenVM forbids them there), which is why both calls sit
in plain write methods.

## Calling it from genlayer-js

```js
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet, account: createAccount(PRIVATE_KEY) });
const CC = "0x...";  // ClaimCheck address

const hash = await client.writeContract({
  address: CC, functionName: "check", value: 0n,
  args: ["RFC 9110, HTTP Semantics, was published in June 2022.",
         ["https://www.rfc-editor.org/rfc/rfc9110.txt", "https://datatracker.ietf.org/doc/html/rfc9110"],
         2n, ""],
});
await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" });
const rec = await client.readContract({ address: CC, functionName: "find",
  args: ["RFC 9110, HTTP Semantics, was published in June 2022.",
         ["https://www.rfc-editor.org/rfc/rfc9110.txt", "https://datatracker.ietf.org/doc/html/rfc9110"], 2n, ""] });
// rec.verdict, rec.id; client.readContract({ ..., functionName: "get_check", args: [BigInt(rec.id)] }) for excerpts
```

Observed on studionet: a `find()` read from genlayer-js with three long URLs failed in the
RPC's own argument decoding (`RLP string ends with … superfluous bytes`), while one- and
two-source reads worked. If that happens, read by id with `get_check` / `get_verdict`.
Contract-to-contract `view().find()` (as in the consumer) does not go through that RPC path.

## Live deployment

Network: GenLayer **studionet** (`https://studio.genlayer.com/api`), 2026-11-02.

| Contract | Address | Deploy tx |
|---|---|---|
| ClaimCheck (`owner` = Blair's wallet `0x920fbbCf2106B693A857D1995c198e341220a46A`) | `0x2FA85060bd7fCBc0B0f07A42A19a64aC2667d76F` | `0x8696386e8d9655e81886e35ba253e057403727b4f8eff62306284f13d4bd6d1d` |
| ClaimCheckConsumer (`oracle` = ClaimCheck) | `0xBE99d6e3E802E9d06182Ff775f7f0f70b115a4fe` | `0x698c9ceb7000544d5b39f71ab2d636eb255c97200bc417e2e9ef4fab0c55d17f` |

Explorer: https://explorer-studio.genlayer.com/address/0x2FA85060bd7fCBc0B0f07A42A19a64aC2667d76F,
and it can be opened in Studio at https://studio.genlayer.com/?import-contract=0x2FA85060bd7fCBc0B0f07A42A19a64aC2667d76F.

**Code pin.** The stored code of both contracts, read with `gen_getContractCode` and
canonicalised (CRLF to LF, one trailing newline), has the same sha256 as the repo files.
ClaimCheck: `cf6a57b947509c28aeeaebf3f2aba0e1540370e63be5b26d754a161623ea13ac`.

Every transaction below reached **FINALIZED**. The read-backs are in
[`docs/live/claim-check-run.json`](live/claim-check-run.json) (`reads.get_check_1` to `_8`).

| # | What | Tx | Result |
|---|---|---|---|
| 1 | Wikipedia, Eiffel Tower, 1-of-1 | `0x4739db7d…51cb` | **NOT_FOUND**: every validator labelled the page SILENT. The fact was outside the 7,500-character context its retrieval chose from a 75k-character article. Re-run as #13. |
| 2 | RFC 9110 date, **2-of-2** (rfc-editor.org text + datatracker.ietf.org HTML) | `0x9a606fe1…270c` | **SUPPORTED**: both SUPPORTS with verified excerpts (`Category: Standards Track June 2022 …`, `Standards Track June 2022`) |
| 3 | RFC 9110 "March 2015" | `0x98f10ad0…fee8` | **CONTRADICTED** |
| 4 | RFC 9110 "written by twelve astronauts" | `0x998d568c…3efd` | **CONTRADICTED**: validators cited the real author list (intended NOT_FOUND; see #12) |
| 5 | RFC 9110 date, **2-of-3**, third source is the [hostile repo page](../examples/claim-check/pages/injected-test-page.txt) | `0x3ee1471a…63c1` | **SUPPORTED**: two SUPPORTS, and the hostile page was labelled **INJECTED** (`page_injection_screen`) and excluded |
| 6 | `http://` source | `0x8b9021ec…a1d7` | reverted: `[EXPECTED] source url must use https://` |
| 7 | injection phrase in the claim | `0x2629ce2c…6c34` | reverted: `[EXPECTED] claim contains instructions aimed at the checker` |
| 8 | `recheck(2)` | `0xcd3cb67d…d443` | revision 2, `changed: false`, still SUPPORTED |
| 9 | consumer `open_case` | `0x1c2cb14a…bc34` | case 1 |
| 10 | consumer `request_check`: **emit()** to ClaimCheck | `0x68348c81…5285` | the emitted message ran as ClaimCheck check #6 (requester = the consumer contract): SUPPORTED |
| 11 | consumer `settle`: **view().find()** on ClaimCheck | `0xdfe3942a…de13` | case settled, `outcome: claim_upheld`, `check_id: 6` |
| 12 | unrelated claim against the RFC text | `0xe2457d4b…07b9` | **NOT_FOUND** (SILENT) |
| 13 | #1 again, with `required_quote_hint` | `0x0ff0bc3c…3d77` | **SUPPORTED**: excerpt `lattice tower on the Champ de Mars in Paris` |

Final `stats()`: 8 checks (4 SUPPORTED, 2 CONTRADICTED, 2 NOT_FOUND), 1 recheck, 0 with drift.
Validators voted `agree` by majority on every transaction; the vote counts per transaction
are in the JSON.

Reproduce with `scripts/claim_check_live.mjs`; `CC_APPEND=1` with `CC_PLAN` adds checks to an
existing run.

## Verify locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest tests/direct/test_claim_check.py -q     # 110 tests, web + LLM mocked
.venv/bin/genvm-lint check contracts/claim_check.py && .venv/bin/genvm-lint typecheck contracts/claim_check.py
bash scripts/verify.sh                                             # the whole repo, ClaimCheck lint included
```

Canonical code digest: convert CRLF to LF, keep exactly one trailing newline, then take the
sha256. `scripts/claim_check_live.mjs` compares it with `gen_getContractCode` for both deployed
contracts before sending anything.
