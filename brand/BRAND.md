# DelayProof brand kit

## 1. Positioning in one breath
Your flight was late. DelayProof checks the real flight record, has an independent network rule on whether you're owed EU/UK compensation, and gives you a public, shareable proof you can take to the airline or to anyone who has opted in to pay.

**Promise:** the facts, checked by more than one judge, in plain English.
**What we never claim:** that we're a court, a law firm, or that the airline must obey the ruling.

## 2. Voice

| We are | We are not |
|---|---|
| The friend who used to work at the airline and knows the rules | A claims-farm shouting "GET YOUR CASH NOW" |
| Plain, specific, numbers-first: "3h 47m late. 1,858 km. €400." | Vague: "you may be eligible for up to…" with no reason |
| Calm and sure of the facts, honest about limits | Legalese, or crypto words on the surface |
| A little dry and funny about airport misery | Snarky about airline staff (the gate agent isn't the villain) |

**Rules**
1. Lead with the number, then the reason. "You're owed €400 because you landed 3h 47m late on a 1,858 km EU flight."
2. Say "the network" or "independent validators", never "nodes", "chain", "smart contract", "LLM consensus" or "on-chain" on the surface. The **How it works under the hood** page and the FAQ can use them.
3. Every money screen carries the honesty line: *Information, not legal advice. Airlines aren't legally bound by this ruling.*
4. "Not owed" is said kindly and with the reason. Never "rejected".
5. Testnet is said plainly: *"We're in test mode. No real money moves yet."*
6. Use second person and contractions. Sentences under about 20 words.

**Word list:** ruling (not verdict), owed / not owed / needs a closer look, appeal, proof card, public record, opt-in payers, the network, validators.
**Avoid:** guaranteed, sue, lawsuit, crypto, token, wallet (surface), AI-powered (as a headline), eligible (use "owed").

## 3. Color tokens

Concept: **night departure board.** Deep ink navy, warm boarding-pass paper, departure-board amber as the brand accent. Status colors are kept separate from the brand amber so "owed" never reads as a warning.

```css
:root {
  /* brand */
  --dp-amber:        #F2A93B;  /* brand fill: mark, big amount on dark, CTA fill (with ink text) */
  --dp-amber-ink:    #9A5B00;  /* amber for TEXT on light (4.9:1 on paper) */
  --dp-ink:          #0F1B2D;  /* primary text on light; text on amber (8.6:1) */

  /* light surfaces */
  --dp-bg:           #F7F3EC;  /* page: boarding-pass paper */
  --dp-surface:      #FFFFFF;
  --dp-line:         #E4DDD0;
  --dp-text:         #0F1B2D;  /* 15.6:1 */
  --dp-muted:        #5B6676;  /* 5.3:1 */

  /* status (light) */
  --dp-owed:         #127A4F;  /* 4.8:1 */
  --dp-not-owed:     #5B6676;
  --dp-review:       #2557C7;  /* "needs a closer look" / pending, 5.8:1 */
  --dp-appeal:       #5B3FC4;  /* appeal open / under appeal, 6.4:1 */
  --dp-late:         #B4400A;  /* delay figures, errors, 5.2:1 */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --dp-bg:        #0B1422;
    --dp-surface:   #121D2F;
    --dp-line:      #24324A;
    --dp-text:      #F3EFE6;  /* 16.1:1 */
    --dp-muted:     #9AA6B8;  /* 7.5:1 */
    --dp-amber-ink: #F2A93B;  /* amber is readable as text on dark (9.2:1) */
    --dp-owed:      #3CCB8A;  /* 8.9:1 */
    --dp-not-owed:  #9AA6B8;
    --dp-review:    #7FA6FF;
    --dp-appeal:    #B39DFA;
    --dp-late:      #FF8A4C;
  }
}
:root[data-theme="dark"] { /* same values as the dark block above */ }
```

Contrast ratios were checked against the page background for each mode. Never set body text in `--dp-amber` on light backgrounds; use `--dp-amber-ink`.

**Proof card (always dark, so it looks the same everywhere it's shared):** radial gradient `#18304F → #0E1A2C → #08101C`, ticket panel in `--dp-bg` paper.

## 4. Type

| Role | Typeface (Google Fonts) | Use |
|---|---|---|
| Display | **Schibsted Grotesk** 700–900 | Amounts, rulings, headlines. Tight tracking (−2% to −4%) at large sizes. A newsroom grotesk: it reads as "reported fact". |
| UI / body | **Inter** 400–600 | Everything else. 16px minimum body on mobile. |
| Data | **IBM Plex Mono** 400–500 | Flight numbers, times, ruling IDs, small all-caps labels (tracking +0.15em). The departure-board texture. |

Scale (mobile): 12 / 14 / 16 / 20 / 28 / 40 / 64, with the amount on the result screen at 72–96.

## 5. Logo

**Mark (`logo.svg`):** a boarding-pass stub (rounded rectangle with two side notches) in amber, holding a check mark in ink. The check's long stroke climbs like a take-off path and ends at a beacon dot, like a runway light or the moment the plane lifts off. It reads as "ticket + verified" at 16px and as a stamp at large sizes.

**Lockup (`logo-lockup.svg`):** the mark plus the "DelayProof" wordmark in Schibsted Grotesk ExtraBold, with "Proof" in amber-ink.

**Usage**
- Clear space: the height of the beacon dot × 3 on all sides.
- Minimum size: 20px mark, 96px-wide lockup.
- On dark: the mark is unchanged (amber stub, ink check). The wordmark switches to paper `#F7F3EC` with "Proof" in amber.
- Don't: outline the stub, rotate it, add a plane silhouette, or use any airline's logo, livery colors or tail art anywhere in the brand.

**App icon:** the mark centered on `--dp-ink` with 18% padding.

## 6. Proof card (`proof-card.svg`)

1080×1350 (4:5): fills a phone screen in a feed and crops cleanly to 1:1 for X. Built from top to bottom so the screenshot tells the story even if someone only sees the top half.

1. Header: mark, wordmark, "PUBLIC RULING #ID"
2. "THE NETWORK RULED" → "You're owed" → **€400** (270px) + "per passenger · under EU 261/2004"
3. Consensus seal ("VERIFIED BY CONSENSUS · PUBLIC RECORD")
4. Boarding-pass panel: route, flight, date, arrival delay, distance, scheduled vs actual, cause finding
5. Validator dots: "5 of 5 independent validators agreed" + appeal window
6. Footer: verify URL, "Check the record yourself →", honesty line

Template fields are listed in a comment at the top of the SVG (`{{AMOUNT}}`, `{{FLIGHT}}` and so on). The sample uses the placeholder flight code **XX 123** and the airport codes LIS/AMS; no airline names or marks appear.

**Variants to make next:** "Not owed" (paper background, slate amount "€0", with the reason in one line, so people share honest results too), "Under appeal" (violet seal), and a 1080×1920 Stories version.

## 7. Imagery and motion
- Photos: real, slightly tired travelers in terminal light. No stock "happy businessman with suitcase".
- Illustration: flat departure-board rows and ticket stubs only.
- Motion: departure-board flip for numbers (the amount flips in from "— — —"), validator dots filling one by one (about 250ms each), and the seal stamping in with a light 2° rotation settle.
