# Issuing and honouring licence keys

## What a key is

A key is a signed statement: *this name, this plan, from this date to that date.*
It is signed with an ECDSA P-256 private key held only by the publisher, and
verified in the customer's browser against the public key compiled into
`src/license.ts`. No server, no account, no customer record leaves the device.

Format: `HSB1.<base64url payload>.<base64url signature>`

The signature covers the exact payload bytes, so a key cannot be edited — changing
the plan or the expiry date invalidates it. There is a test for that.

## One-time setup (already done for this checkout)

```bash
node tools/make-license.mjs --init
```

This wrote the private key to `../hisaab-signing-key.json` (outside the
repository, mode 600) and the matching public key into `src/license.ts`.

**The private key must be backed up, encrypted, somewhere you will still have in
three years.** If it is lost, every key already issued keeps working, but no new
or renewal key can ever be signed and every customer has to be migrated to a new
public key in a new release. Never commit it, never paste it into a chat, never
put it in the bundle.

If it is *leaked*, anyone can mint keys. The recovery is: run `--init --force`,
ship a release with the new public key, and reissue keys to paying customers from
the sales ledger. That is the reason the ledger matters.

## Issuing a key after payment clears

```bash
node tools/make-license.mjs --name "Ayesha Khan" --plan pro --years 1
node tools/make-license.mjs --name "Nadeem & Co" --plan accountant --years 1
node tools/make-license.mjs --verify HSB1....      # check before sending
```

Then, in your own sales ledger, record the licence id the tool prints, the name,
plan, amount paid, rail it came in on, the date and the expiry. The app keeps no
record of any sale — this ledger is the only one that exists.

Turnaround promise in the app is one working day. Keep it or change the promise in
`src/pricing.ts`.

## Renewals

Issue a fresh key with `--from` set to the day after the old one expires. The
customer pastes it over the old one. There is no automatic renewal and nothing is
ever charged without the customer paying again, by design.

## Refunds

`src/pricing.ts` promises 14 days, no questions asked. There is no remote
revocation: a refunded key keeps working until it expires. That is a deliberate
trade for having no customer accounts. Price the occasional abuse in; do not add
phone-home licensing to prevent it.

## What enforcement does and does not do

It does: stop an honest customer from using paid steps they have not paid for,
and tell them clearly what covers what.

It does not: resist a developer. The gate is JavaScript in a public bundle. Anyone
who wants to can remove it, and the app says as much in Settings. We are selling
maintained rules, imports that keep working and support — not a lock.

An expired or absent key never blocks records, the estimate, CSV exports or
encrypted backups. Only imports, extra accounts and the Filing Pack stop.

## Trial

Creating a private workspace starts a 14-day Pro trial, recorded as
`license.trialStarted` inside the encrypted workspace. Deleting the workspace and
making a new one restarts it. We are not going to fight that.
