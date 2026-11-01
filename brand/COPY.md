# DelayProof copy

Copy notes:
- EU 261/2004 amounts: €250 (flights up to 1,500 km), €400 (EU flights over 1,500 km, other flights 1,500–3,500 km), €600 (over 3,500 km). Can be halved when rerouting gets you there close to the original time.
- UK261 (retained EU law) amounts: £220 / £350 / £520 on the same distance bands.
- The usual trigger: arriving **3+ hours late**, a cancellation with less than 14 days' notice, or denied boarding, unless the airline shows "extraordinary circumstances".
- Keep the honesty line on every money screen.

---

## Landing page

### Hero
**Eyebrow:** FOR ANYONE WHO'S STARED AT A DEPARTURE BOARD
**H1:** Your flight was late. Find out if you're owed €250 to €600 (£220 to £520 in the UK).
**Sub:** Enter your flight and date. An independent network checks what really happened and rules on whether EU or UK law says you're owed money. It takes about a minute and is free.
**Form:** [ Flight number, e.g. XX 123 ] [ Date ] → **Check my flight**
**Under the button:** No sign-up to check. Information, not legal advice.
**Trust strip:** Built by a co-founder of TrustaBit, a travel-tech company that turned airline delays into compensation. · Every ruling is public and can be appealed. · Test mode: no real money moves yet.

### How it works (3 steps)
1. **Tell us the flight.**
   Flight number and date. That's it: no boarding pass upload, no inbox access.
2. **The network checks and rules.**
   Several independent validators each pull the real flight record (scheduled time, actual arrival, distance, reported cause) and apply the EU/UK rules. They have to agree, or the case is flagged for a closer look.
3. **Get your proof.**
   You get a plain-English ruling, the evidence behind it, and a proof card you can share or send to the airline. If someone has opted in to pay out on rulings like yours (a travel insurer, a card perk, your travel group), they can pay automatically.

### "Why not just ask ChatGPT for a letter?"
**H2:** Why not just ask a chatbot to write the letter?
**Body:**
You can, and for some people that's enough. Here's what's different:

- **Facts, not vibes.** A chatbot writes from what you tell it. DelayProof's validators each fetch the actual flight record on their own and must agree on what happened before anything is decided. If they can't agree, we say so.
- **A neutral, public record.** Your ruling lives at a public link with the evidence attached. The airline, your insurer, or a friend can check it themselves. It isn't your word against theirs, and it isn't us vouching for you.
- **It can pay out by itself.** Insurers, card programs and travel groups can opt in to pay automatically when the network rules "owed". A letter can't do that.
- **You can appeal.** If you think a ruling is wrong, you can ask for it to be re-examined by a larger group of validators.

**The honest part:** the airline doesn't have to accept our ruling. It's not a court decision and we're not your lawyer. What it gives you is a checked set of facts and the rule that applies, which is usually what moves an airline. If it doesn't, the ruling is your evidence for the national enforcement body or small-claims court.

### Closing CTA
**H2:** Thirty seconds to find out.
**Button:** Check my flight
**Small:** Covers flights departing the EU or UK on any airline, and flights into the EU/UK on an EU or UK airline.

### Footer line
DelayProof gives information, not legal advice. Rulings are not binding on airlines. Currently running in test mode; no real funds are paid.

---

## FAQ (8)

**1. Is this free?**
Checking a flight and getting a ruling is free. In test mode nothing is charged and nothing is paid. When we go live we'll show any fee before you commit to anything, and we'll never take a cut of money an airline pays you directly.

**2. Which flights are covered?**
EU rules cover flights leaving an EU airport (any airline) and flights arriving in the EU on an EU airline. UK rules work the same way for the UK. Iceland, Norway and Switzerland generally apply the EU rules too. A US domestic flight isn't covered, and we'll tell you straight away.

**3. How late is "late enough"?**
Usually 3 hours or more at arrival, which means when the doors open, not when the wheels touch down. Cancellations with less than 14 days' notice and being bumped can also count.

**4. What's the network, and who are the validators?**
A group of independent computers run by different operators. Each one looks up your flight on its own and applies the rules. A ruling only stands when they agree. Under the hood it runs on GenLayer, a blockchain built for this kind of judgment call, but you never need a wallet, a token, or to know any of that.

**5. Does the airline have to pay because you said so?**
No. Our ruling isn't legally binding on airlines. It's a checked record of the facts and the rule that applies. Most people use it to file with the airline; if the airline refuses, it's evidence for the national enforcement body or a small-claims court.

**6. What if the airline says it was the weather (or a strike)?**
"Extraordinary circumstances" like severe weather, air-traffic-control restrictions or security threats can cancel the right to compensation. Technical faults and the airline's own staff strikes usually don't. The validators look for the reported cause, and if it's unclear the ruling says "needs a closer look" instead of guessing.

**7. Can I appeal a ruling?**
Yes. During the appeal window (shown on your ruling) you can add a public evidence link (for example the airline's delay notice or a news report), and a larger panel re-examines the case: 1, then 3, then 5 analysts per validator. The original ruling and the appeal both stay on the public record.

**8. What do "opt-in payers" mean, and is my data public?**
Some insurers, card programs and groups can choose to pay automatically when the network rules "owed". In test mode these are test pools with no real money. Your ruling is public, but it shows the flight, date and outcome, not your name, email or booking reference, unless you choose to add them.

---

## Microcopy by app state

**Global test-mode banner:** Test mode: rulings are real checks, but no real money moves yet.

**Honesty line (every result screen):** Information, not legal advice. Airlines aren't legally bound by this ruling.

| State | Title | Body | Primary / secondary action |
|---|---|---|---|
| Empty / start | Where were you headed? | Flight number and date. We'll find the rest. | **Check my flight** |
| Typing: invalid flight number | That doesn't look like a flight number | It's usually 2 letters + up to 4 numbers, like XX 123. Check your booking email. | (inline) |
| Date in the future | That flight hasn't happened yet | Come back after you land. Want a reminder? | **Remind me** / Change date |
| Flight hasn't landed yet | Still in the air (or on the ground) | Rulings use the final arrival time. We'll check automatically once it lands. | **Notify me when it lands** |
| Looking up | Finding your flight… | Pulling the schedule and the actual arrival time. | (spinner, about 3s) |
| Several matches | Which one was yours? | That flight number ran more than once that day. | List: route + departure time |
| Not found | We can't find that flight | Check the number and date. Codeshares can use a different number; try the one on your boarding pass. | **Try again** / Enter route instead |
| Out of scope | These rules don't cover this flight | EU/UK compensation applies to flights leaving the EU or UK, or arriving on an EU or UK airline. This one doesn't qualify, but your airline's own policy might. | **Check another flight** |
| Under 3 hours | Close, but under the line | You arrived {{DELAY}} late. Compensation usually starts at 3 hours. You may still be owed meals or care on the day. | **See what else you're owed** |
| Network deliberating | The network is checking | {{N}} independent validators are each pulling the record for {{FLIGHT}}. This usually takes under a minute. | Validator dots fill as each one reports |
| Validators disagree (pre-ruling) | Not everyone agrees yet | When the validators disagree, more of them are brought in. Hang tight. | (auto) |
| **Ruling: owed** | **You're owed {{AMOUNT}}** | The network ruled {{AGREE}} that your {{DISTANCE}} flight arrived {{DELAY}} late with no extraordinary circumstance found. That's {{AMOUNT}} per passenger under {{RULE}}. | **Get my proof card** / Send to airline |
| Ruling: owed, reduced | **You're owed {{AMOUNT}}** | You were rerouted and got there within {{X}} hours of plan, so the amount is halved under the rules. | **Get my proof card** |
| **Ruling: not owed** | Not owed this time | The network found {{REASON, e.g. "the delay was caused by an air-traffic-control restriction, which counts as an extraordinary circumstance"}}. We know that stings. | **Appeal with more evidence** / Check another flight |
| **Ruling: needs a closer look** | This one needs a closer look | The flight record doesn't clearly show {{WHAT}}. Rather than guess, we've flagged it. Adding a public link (like the airline's delay notice) and appealing often settles it. | **Add evidence** |
| Proof card ready | Your proof is ready | Share it, save it, or send it straight to the airline. Anyone can check it at the link. | **Share** / Save image / Copy link |
| Send to airline | Your claim, ready to send | We've filled in the facts and the rule. Review it, add your booking reference, and send it from your own email. | **Open in email** / Copy text |
| Appeal: start | Think we got it wrong? | Tell us what we missed and add any proof. A larger group of validators will look again. Appeals close {{APPEAL_UNTIL}}. | **Start appeal** |
| Appeal: submitted | Appeal in | A bigger panel is re-checking your case. Both rulings stay on the public record. | (status) |
| Appeal: ruling changed | The appeal changed the ruling | The larger panel ruled {{OUTCOME}}. Your proof card has been updated. | **See new proof card** |
| Appeal: ruling stands | The original ruling stands | The larger panel looked again and agreed with the first ruling: {{REASON}}. | **Check another flight** |
| Appeal window closed | This ruling is final on DelayProof | The appeal window ended {{DATE}}. You can still take your case to the airline or the enforcement body. | Send to airline |
| Payout: pool available | {{PAYER}} pays out on rulings like this | You can opt in to receive {{AMOUNT}} automatically. (Test mode: a test payout, not real money.) | **Opt in** / No thanks |
| Payout: no pool | No automatic payer for this one | You can still claim directly from the airline with your proof. | **Send to airline** |
| Payout: pending | Payout on its way | {{PAYER}} has been notified. Test mode: this is a simulated payment. | (status) |
| Payout: complete | Paid: {{AMOUNT}} (test) | In test mode, no real funds moved. When we go live, this is where real money lands. | **Share your proof** |
| Offline / error | Lost signal | We couldn't reach the network. Your details are saved; try again in a moment. | **Retry** |
| Network busy | The network's busy | Lots of delayed flights today (sounds about right). Your case is in the queue. | (auto retry) |
| Rate limited | That's a lot of flights | You've checked {{N}} flights in the last hour. Give it a few minutes. | — |
| Claim time limit | Check the clock on your claim | How long you have to claim depends on the country, and some limits are short. Don't sit on it. | Learn more |
