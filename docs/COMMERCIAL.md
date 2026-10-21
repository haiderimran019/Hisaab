# Hisaab · commercial direction

Written 21 October 2026. This document argues for one direction and says plainly
what is still unproven. Nothing in it is customer evidence: there are no paying
customers, no interviews and no retention data yet.

## 1. Blunt assessment of what existed before this change

**Valuable.** The deterministic calculation layer is the real asset. Gross
proceeds, fees, tax base and net settlement are kept apart; the export tax base
does not quietly shrink by expense deductions; withholding is not assumed
refundable; unsupported profiles are refused instead of guessed at. Every rate
carries a rule version and a source. That discipline is rare in this market and
is hard to copy casually, because copying the interface does not copy the
judgement about what must not be conflated.

**Weak.** The product asked the customer to do all the typing. A freelancer with
40 payments a year was being asked to key in 40 rows the bank already holds, and
got back arithmetic a spreadsheet also does. That is the honest answer to "why
would anyone pay for this": before this change, they would not.

**Missing.** Anything that removes work. No statement import, no duplicate
detection, no own-transfer detection, no reconciliation, and no deliverable a
practitioner could accept without re-asking for documents.

## 2. Three directions considered

| | A · Freelancer bookkeeping (chosen) | B · Accountant workspace | C · Wealth-statement preparer |
|---|---|---|---|
| Buyer | Pakistani freelancer paid in foreign currency | Tax practitioner filing 50–500 returns | Salaried or mixed filer facing a wealth statement |
| Painful job | "My bank shows amounts I cannot tie to my invoices, and filing season is a weekend of scrolling" | "Half my cost is chasing clients for documents" | "I cannot explain my closing assets" |
| Why they pay | One evening of reconciliation instead of a weekend; a pack the accountant accepts first time | Fewer document round-trips per client | A defensible reconciliation |
| Competition | Spreadsheets, free calculators, Befiler-style filing services | Practice software, Excel, juniors | Accountants |
| Recurring use | Monthly imports, invoice chasing, evidence as it arrives | Continuous, all season | Once a year — weak |
| Risk | Low willingness to pay; imports must work on real files | Multi-tenant security, permissions, support load | Tax correctness risk is highest here, value is seasonal |
| Economics | Low price, high volume, support is the cost | High price per seat, high obligation | Low repeat, high liability |

**Recommendation: A first, then B.** Not because A is more lucrative — B has far
better margin per support hour — but because A is the only one we can build
safely now without customer accounts, document storage, per-client permissions
and an audit trail. A also teaches us which statement formats actually appear,
which is the input B depends on. Build A, learn the file formats and the real
support load, then sell B to accountants using the same engine.

**What would change this:** if two or three accountants each said they would pay
for a multi-client version before a single freelancer paid for A, invert the
order. If imports cannot be made to work on real Pakistani bank CSVs — if the
exception rate stays high after five real formats — the whole premise weakens and
the product should go back to being a free calculator.

## 3. The promise we are now selling

> Import your bank statement, decide what each line is, and leave with a package
> where every figure points at a document — or at something you explicitly said.

Three properties make that defensible, and each is structural in the code rather
than a marketing line:

1. **Nothing becomes income without a person saying so.** Imported lines sit as
   `pending` until classified. Automation that silently books income is how these
   tools lose trust the first time they are wrong.
2. **A difference is never hidden.** `reconcile()` reports the unexplained amount,
   and the Filing Pack prints unresolved items on its front page. We will not make
   a reconciliation reach zero by inventing a balancing entry.
3. **Every number is traceable.** A receipt created from a statement line keeps
   that account, row number and date, and the pack cites them.

That is also the answer to "the source is public, so why can't someone copy it?"
They can copy the interface. What they would have to reproduce is maintained
Pakistani rules with versions and sources, imports that keep working as banks
change their exports, and the willingness to show a customer a number that does
not balance. The paid value is maintenance and trust, not secrecy.

## 4. Price, and why this shape for Pakistan

**PKR 2,400 a year (PKR 200 a month), with PKR 1,500 for the first year for the
first 200 keys.** This honours the founder's original PKR 1,500 number as a launch
price rather than a permanent one.

Reasoning:

- Card-on-file recurring billing is not a realistic default here. Easypaisa,
  JazzCash, Raast and bank transfer are. So the product takes an **annual licence
  key** issued after payment clears, verified offline. No card details reach us,
  no customer-data backend exists to breach, and nothing recurs without a
  deliberate renewal.
- PKR 2,400 sits well below a filing service such as Befiler's advertised
  PKR 3,900 essential plan. That is deliberate, and it is **not** a like-for-like
  comparison: they file for you with a tax team, we do not file anything. We are
  priced as bookkeeping software that makes filing cheaper, not as a substitute
  for a practitioner.
- PKR 1,500 flat was too low to carry a support promise. At PKR 125 a month, a
  single 20-minute support conversation costs more than the year's revenue.

**Where the money actually goes.** Hosting is effectively free (static build on
GitHub Pages, no server, no database). The binding costs are human:

- Issuing keys by hand: ~5 minutes each. 1,000 customers ≈ 83 hours a year.
- Support: if the average customer needs 20 minutes a year, 1,000 customers ≈
  330 hours — about two months of full-time work.
- Payment rail fees: roughly 1–2% on wallet collections.

So 1,000 paying customers is about PKR 2.4m of revenue against roughly 400 hours
of founder time. That is a viable solo business and a bad one to scale by hiring.
It is also why the Accountant tier matters: one accountant serving 60 clients is a
fraction of the support load of 60 individuals, at six times the price.

**None of these are forecasts.** They are the arithmetic that has to hold, with
numbers to be replaced by measurements.

## 5. What is gated, and what never is

Gated behind Pro: more than one account, more than one import a month, imports
larger than 60 rows, and the Filing Pack.

Never gated, in any state, including an expired key: reading your own records,
editing them, the tax estimate, every CSV export, and encrypted backup and
restore. A customer's books are theirs. Holding data hostage to force a renewal
would destroy the trust the product is built on, and a local-first app that did it
would deserve to fail.

Enforcement is client-side and we say so in the app. Someone who edits the
published JavaScript can lift the gate. That is accepted.

## 6. How to find out whether any of this is true

In order, with thresholds set before looking at the results.

1. **Ten statements, consented and redacted.** Ask ten freelancers for one real
   bank CSV each. *Pass:* at least seven import with under 10% of rows landing in
   the unreadable list, and no wrong sign or wrong date in a spot-check of 20
   rows per file. *Fail:* rebuild the parser around the formats we actually see
   before selling anything.
2. **Eight task tests.** Watch eight people import, classify and reconcile one
   month unaided. *Pass:* six finish in under 20 minutes without being rescued,
   and can say what the unexplained figure means. *Fail:* the review queue is the
   problem, not the price.
3. **Three practitioners read a Filing Pack.** *Pass:* at least two say they
   would accept it instead of their usual document request, and name at most two
   additions. *Fail:* the pack is the wrong deliverable; ask what they would
   accept instead.
4. **Twenty paid keys at PKR 1,500, before any further building.** Money, not
   interest. *Pass:* 20 keys inside six weeks from one channel. *Fail at under
   8:* the promise is not landing; interview the people who declined before
   changing the price.
5. **Renewal, a year later.** *Pass:* over 45% renew at PKR 2,400. Under 25% means
   this is a seasonal tool and should be sold once a year, not as a subscription.

Channels to test, in cost order: freelancer WhatsApp and Facebook groups,
university freelancing societies, coworking spaces, then accountants. All four are
hypotheses; none is a partnership.

## 7. Before charging anyone, these must exist

Not software tasks, and none of them are done:

1. **A qualified Pakistani practitioner's written review** of `docs/TAX-RULES.md`,
   the s.154A conditions, the slab and surcharge table, and the Filing Pack's
   boundary language. Paying for reliance on outputs that no practitioner has
   checked is the single largest risk in this product.
2. **Published terms, privacy notice and refund policy.** A 14-day no-questions
   refund is assumed in `src/pricing.ts` and must be honoured in writing.
3. **Real payment details** in `src/pricing.ts`, plus a sales ledger recording
   every key: id, name, plan, amount, date, expiry.
4. **A correction process.** If a rule turns out to be wrong, we need a way to
   notify affected customers and reissue packs. Decide this before the first sale,
   not after the first mistake.

## 8. What would make me stop

- Imports fail on real files after two rebuilds (step 1 fails twice).
- Under eight paid keys in six weeks from a channel that produced real traffic.
- No practitioner will put their name to the rule review.
- Renewal under 25% in year two.

Any one of those means the honest move is to narrow — free calculator, or a
service sold to accountants only — not to add features.
