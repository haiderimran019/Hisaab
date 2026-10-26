# Privacy notice
_Last updated 27 October 2026. Written to be read, not to protect us._
## The short version
Your encrypted workspace runs in your browser. There is no server holding your books and no database of anybody's financial records that we could hand over, lose or sell. We cannot read your workspace or your passphrase. A document you deliberately send to a reader is the exception described below.
If you buy a licence, that purchase is separate, with its own small record — a name, an email address, what you paid and a key — described below. The encrypted workspace and the buyer record never meet: the service holds no customer financial records.
## What is stored, and where
- **On your device only:** your receipts, invoices, expenses, bank accounts, imported statement lines, attached receipt images, tax declarations, licence key and security settings. A random key encrypts the workspace; your passphrase protects that key. The encrypted result stays in this browser's local storage.
- **Nowhere else:** there is no copy on any server of ours. Backups exist only where you save them.
## Every outside request this app can make
There are four, and that is the complete list for this app. The optional Worker also has portal and review APIs, but this app has no screen that calls them.
- **Reference exchange rates**, only when you press the button for them: your browser asks `open.er-api.com` for published rates. No financial data is sent, but like any web request the provider necessarily sees your IP address and the time you asked. **Never touch the network** in Privacy and security stops even this.
- **A usage ping**, once a day, **only if you switch it on** — it is off until you do. It carries the date, which build you are running, and whether a licence is active. **No identifier of any kind is sent**, so we can count how often Hisaab is opened but can never tell one person from another, or link two days together.
- **Your email address**, only if you type it into the key form and press the button. It is used to send your licence key and occasional product news. We never sell it, one click unsubscribes, and it is never connected to anything financial because we hold nothing financial. You do not need to give one at all — a key can reach you any way you like.
- **A statement you choose to have read**, only when you pick a PDF or photo and confirm the warning on that screen. The file and your licence key go to the reading service named in the dialog. The file is used to transcribe proposed rows and is not stored by us; a per-licence counter records the request. You check and confirm the returned rows. Everything about this is off unless you start it, and CSV import never involves it.
Fonts and icons are served from the app itself. There are no trackers, no advertising pixels, no cookies and no third-party scripts of any kind.
**What never leaves, under any setting:** your income records, clients, invoices, expenses, bank accounts, statement lines, tax figures and passphrase. There is no endpoint that accepts them — the service refuses any request carrying such a field, and there is a test that fires realistic ones at it to prove it. The one exception you can create yourself is a document you deliberately send to be read, and that screen says so before anything moves.
**Hisaab is not connected to FBR, to your bank, or to any payment provider.** It cannot file a return, pay a tax, move money, or tell anyone anything about you. It is a private notebook that does arithmetic.
## What we hold about paying customers
If you buy a licence, we learn what you tell us when you pay: the name to put on the key, the email address to send it to, and whatever your payment method shows us. We keep that in our own sales ledger — name, email, plan, what you paid, the date and the expiry — so we can honour renewals and refunds. Alongside it we may hold a portal sign-in session, and a review job if you asked for one.
Normal app use verifies your key on your device against a signature, so it keeps working offline. If you choose optional document reading, that request sends the key to the Worker for entitlement and quota checks.
**With one exception, which we would rather state than let you discover.** If you request optional document reading, we count the request against its annual allowance before contacting the reader. We keep a single number per licence per tax year: how many requests it made. That number tells us a licence was used and roughly how often — not what was in any document, not when, and nothing about your figures. It is the only record of use that exists, and if you never request a document read, it never exists for you.
Two things this means in practice, and they cut both ways. We cannot revoke a key, because nothing we hold can reach your device — a refund returns your money and marks our ledger, and your software keeps working. And we cannot restore your workspace, because we have never had a copy of it.
## What you are responsible for
- **Your passphrase.** There is no reset or recovery service. Keep it: a backup opened on another device needs the passphrase, even if a passkey was registered on the original device.
- **Your backups.** Clearing your browser data deletes the workspace. Export an encrypted backup and keep it somewhere safe.
- **What you export.** CSV files, worksheets and the Filing Pack are ordinary unencrypted files. Treat them like bank statements.
## What encryption cannot do
It protects your records at rest. It cannot protect an unlocked screen, a device with malware, or a browser extension with permission to read pages. Lock the workspace when you step away, and do not enter bank or IRIS passwords into any field here — Hisaab never asks for them and has no use for them.
## Your rights
**Your books.** They are only ever on your device, so you can export all of them at any time and delete all of them at any time. There is no request to make of us, because we have nothing to give you and nothing to erase.
**Everything else.** The optional service can hold your mailing-list address, sales ledger entry and review jobs. Its deletion endpoint removes those records after a confirmed request, retaining only a keyed hash of the address to record that erasure happened. This app does not yet offer a deletion button; contact the repository owner if the service is deployed and you want those records removed. One click on an email also unsubscribes you without signing in.
## Children
This is a bookkeeping tool for working adults. It is not designed for or directed at children.
## Changes
If this notice changes in a way that affects you, the new version ships with an app update and this date changes. We can email you only if you separately gave us an address.
## Contact
Through the repository owner's GitHub contact. Please do not include passphrases, real statements or financial data in any message.

---

This file and the Privacy page inside the app are generated from the same source (`src/ui-privacy.ts`) by `tools/make-privacy.mjs`, so they cannot drift apart — run `npm run privacy` after changing the notice, and `npm run privacy:check` in CI. It describes the fullest build: one with no Hisaab service configured has no usage counting, no sign-up form, no licence portal and no document reading at all, and its own Privacy page says so.
