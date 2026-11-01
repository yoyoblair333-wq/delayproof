# DelayProof launch kit

Channel logic: TikTok/Reels/Shorts reach everyday travelers (crypto never mentioned). X reaches travel-hack and builder audiences (crypto mentioned lightly, under the hood). The GenLayer Discord reaches builders and validators (full technical detail). The demo video works for all three.

Reviving the dormant ~100k TikTok: post 2–3 "I'm back, and here's what I've been building" videos first, so current followers aren't confused by the switch from relationship content. Relationship-advice followers are everyday people who fly. Bridge it: *"I used to tell you when you were owed an apology. Now I tell you when an airline owes you money."*

Every video ends with the same card: the proof card and "Check your flight: link in bio. Test mode, info not legal advice."

---

## 10 TikTok hooks (first 2 seconds)

1. "If your flight landed 3 hours late in Europe, the airline might owe you €600, and they're not going to tell you."
2. "I co-founded a company that got people paid for flight delays. Here's what airlines hope you never learn."
3. "I used to tell you when you were owed an apology. Now I tell you when an airline owes you money."
4. "It's 'the weather,' they said. Let's check if it was actually the weather."
5. "Wheels down doesn't count. Here's the moment that decides if you get paid."
6. "This is what €400 looks like when five judges agree on it." *(show the proof card)*
7. "Don't pay a claims company 35% for something that takes 30 seconds to check."
8. "POV: you're at the gate, it's hour three, and you're doing math." *(cut to the app)*
9. "Your flight from London was delayed? Different rules, same money. Pounds edition."
10. "I asked a chatbot if I was owed money for my flight. Then I checked the actual flight data. They didn't match."

---

## 5 short video scripts (30–45s each, vertical)

### Script 1: "The 3-hour rule" (education, 35s)
- **0–2s** (face to camera, airport B-roll behind): "If your flight landed three hours late in Europe, someone might owe you up to €600."
- **2–10s**: "It's EU law. Any flight leaving the EU or UK, any airline, or into Europe on a European airline."
- **10–20s** (text on screen: 1,500 km = €250 / 3,500 km = €400 / farther = €600): "The amount depends on distance. Short hop, €250. Medium, €400. Long-haul, €600."
- **20–28s**: "Catch: if it was truly out of their control, like a storm or air traffic control, they don't owe you. A broken plane? That's on them."
- **28–35s** (screen recording: type flight → ruling): "I built a free tool that checks the real flight data for you. Link in bio. Info, not legal advice."

### Script 2: "Founder story" (trust, 40s)
- **0–3s**: "Years ago I co-founded a travel company that turned flight delays into compensation."
- **3–12s**: "The thing I learned is that most people never claim. Not because they aren't owed. Because they aren't sure, and the airline isn't going to make it easy."
- **12–25s**: "So I built DelayProof. You type your flight and date. A network of independent checkers each pulls the real flight record, and they have to agree before anything's ruled."
- **25–35s** (show proof card): "You get this: a public, checkable proof. Send it to the airline. Share it."
- **35–40s**: "We're in test mode right now, so no money moves through us yet. Go check your last trip. Link in bio."

### Script 3: "It was the weather" (myth-bust, 30s)
- **0–2s** (green-screen over a gate-announcement screenshot with no airline name): "'Due to weather.' Was it though?"
- **2–12s**: "Airlines can skip compensation for extraordinary circumstances: real storms, airport closures, air traffic control. Not for a technical fault or their own crew shortages."
- **12–24s** (screen recording: "Needs a closer look" state): "When my tool can't tell what really caused a delay, it doesn't guess. It says 'needs a closer look' and asks for your proof."
- **24–30s**: "Honest rulings, even when the answer is no. Link in bio."

### Script 4: "Chatbot vs. the record" (differentiator, 40s)
- **0–3s**: "I asked a chatbot if I'm owed money for my flight. It said yes. Then I checked the flight data."
- **3–15s** (split screen): "The chatbot only knew what I told it. I said 'about three hours'. The real record says 2 hours 52. Under the line."
- **15–30s**: "DelayProof doesn't take your word for it. Several independent validators each pull the record, and they have to agree. Then it goes on a public page anyone can check."
- **30–40s**: "And no, the airline doesn't have to obey it. It's not a court. But facts plus the exact rule? That's what gets claims paid."

### Script 5: "Proof card reveal" (shareable, 25s)
- **0–2s** (phone close-up, departure-board flip sound): "Five judges. One flight. Let's see."
- **2–12s** (screen: validator dots filling one by one): "Each one is checking on its own: scheduled 14:05, landed 17:52, 1,858 km."
- **12–18s** (seal stamps in, €400 flips up): "Five out of five. €400."
- **18–25s**: "Duet this with your worst delay and I'll run it live. Test mode, info not legal advice."

---

## X thread (8 posts)

1/ Most people delayed 3+ hours on a European flight are owed €250–600 by law. Most never claim, because they aren't sure, and checking is a pain.

I built DelayProof to make "am I owed?" a 30-second, checkable answer. (thread)

2/ You enter flight number + date. That's it.

A network of independent validators each fetches the real flight record (scheduled vs actual arrival, distance, reported cause) and applies EU261 / UK261.

3/ They have to agree. If they don't, more validators come in. If it's still unclear, the ruling says "needs a closer look" instead of guessing.

4/ The result is a public ruling page with the evidence attached, plus a proof card you can share or send to the airline. Anyone can verify it, including the airline.

5/ "Why not just ask ChatGPT for a letter?"

A chatbot writes from what *you* tell it. This checks the record independently, puts it on a neutral public page, and lets you appeal.

6/ The honest part: airlines aren't legally bound by our ruling. It's not a court, and it's information, not legal advice. What it is: verified facts + the exact rule. That's usually what gets claims paid.

7/ The new bit: insurers, card perks or travel groups can opt in to pay automatically when the network rules "owed". No forms. Under the hood it runs on GenLayer's intelligent contracts, but travelers never touch a wallet.

8/ We're live on testnet: real checks, no real money yet.

Check your last delayed flight → delayproof.app
Background: I co-founded TrustaBit (airline-delay compensation vouchers). This is the version I always wanted to build.

---

## GenLayer Discord showcase post

**DelayProof: a public court for flight-delay compensation (testnet)**

**What it is:** a consumer app where a passenger enters a flight + date and GenLayer validators decide whether they're owed EU261/UK261 compensation (€250–600). The ruling is public and appealable, and opt-in pools (insurers, card perks, travel groups) can pay automatically on "owed".

**Why GenLayer:** this is a judgment call over messy, non-deterministic web data. Flight status sources disagree by minutes, "cause of delay" is free text, and whether something is an extraordinary circumstance is an interpretation question. That's exactly the Intelligent Contract + Optimistic Democracy sweet spot:
- Each validator fetches flight data from the web independently and runs the rule logic with its own LLM.
- Validators agree on the **ruling** (owed / not owed / needs review + amount band) under the Equivalence Principle, not on byte-identical scraped data. Small timestamp differences don't block consensus; disagreement on the outcome does.
- Appeals map to GenLayer's appeal process: a larger validator set re-examines the case.
- Payout pools are contracts that release funds only on a final "owed" ruling for a matching flight.

**Design choices worth feedback on:**
1. Equivalence criteria: we compare the outcome + amount band + delay bucket (under 3h / 3–4h / 4h+) rather than exact minutes. Too loose? Too strict?
2. Data sourcing: validators are prompted to use more than one public flight-status source and record which ones they used in the rationale.
3. "Needs a closer look" is a first-class result, so the contract never forces a yes/no it can't support.
4. Privacy: the public record holds flight + date + outcome only; no names or booking refs on-chain.

**Status:** testnet only, no real funds. The consumer surface hides crypto completely (no wallet to check a flight).

**Builder:** Blair. I co-founded TrustaBit (airline-delay compensation vouchers) and spent 12+ years in enterprise tech sales. I'm also reviving a ~100k TikTok to bring non-crypto users in.

**Asks:** feedback on the equivalence principle setup, anyone who's done reliable web-fetch patterns for flight data, and validators willing to stress-test the appeal flow.

[demo video] · [contract repo] · [testnet app link]

---

## 90-second demo video storyboard

Format: 16:9 master with a 9:16 safe area marked. Screen recordings use a phone frame. Voiceover is Blair's own voice. Music: low, steady, a single "board flip" sound motif.

| # | Time | Visual | VO / on-screen text |
|---|------|--------|---------------------|
| 1 | 0:00–0:06 | Departure board flipping to DELAYED (generic board, no airline names). Cut to a tired traveler at a gate. | VO: "Three hours at the gate. Is anyone going to pay for that?" |
| 2 | 0:06–0:14 | Title card: DelayProof logo lockup on ink. | VO: "In Europe and the UK, the law says maybe up to €600. Most people never find out." |
| 3 | 0:14–0:24 | Phone: landing page → type "XX 123", pick date, tap **Check my flight**. | VO: "Flight number and date. That's all." Text: *No sign-up to check* |
| 4 | 0:24–0:38 | "The network is checking": five validator dots fill one by one; small cards show "Sched. 14:05 / Actual 17:52 / 1,858 km". | VO: "Five independent validators each pull the real flight record on their own and apply the rules. They have to agree." |
| 5 | 0:38–0:48 | Ruling screen: the €400 amount flips in; the seal stamps; "5 of 5 agreed". | VO: "The network ruled: owed. €400, and here's exactly why." |
| 6 | 0:48–0:56 | Tap **Get my proof card** → the full proof card; swipe to the share sheet. | VO: "You get a public, checkable proof. Share it, or send it straight to the airline." |
| 7 | 0:56–1:06 | Split screen: a chatbot letter on the left, the DelayProof public ruling page with its evidence list on the right. | VO: "A chatbot writes what you tell it. This checks the record independently and keeps it on a neutral public page." |
| 8 | 1:06–1:14 | Payout screen: "Test Travel Pool pays out on rulings like this" → **Opt in** → "Paid: €400 (test)". | VO: "And when an insurer or card perk opts in, it can pay automatically." Text: *Test mode, no real money* |
| 9 | 1:14–1:20 | A "Not owed" card for a weather closure, then the **Appeal with more evidence** button. | VO: "Honest when the answer is no, and you can always appeal." |
| 10 | 1:20–1:26 | Simple diagram: Flight → many validators → one ruling → public record → optional payout. Small caption: "Runs on GenLayer". | VO: "Under the hood, it's GenLayer. On the surface, it's just an answer." |
| 11 | 1:26–1:30 | End card: logo, "Check your flight → delayproof.app", the honesty line. | Text: *Information, not legal advice. Airlines aren't legally bound by rulings. Testnet.* |
