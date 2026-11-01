# Hisaab

**Free, private bookkeeping for Pakistani freelancers.**

[Open Hisaab](https://haiderimran019.github.io/Hisaab/). No purchase, GitHub account, API key or sign-up is needed. Start with the labelled demo, then create an empty encrypted workspace with a passphrase. Each browser holds its own separate workspace.

## Current release

- Muse-inspired chat interface, light/dark themes, self-hosted Figtree, pinned composer and direct record navigation. Income and expense graphs, source-linked analysis and latest-five record previews.
- Guided finance chat works without a model. English, Roman Urdu and Urdu routing; PKR with lakh/crore input, DD/MM/YYYY display, July–June tax years.
- “I got paid $500” or “bijli ka bill 8000” opens a prefilled review form. Missing settlement rates and evidence are never guessed. Chat changes become Confirm / Edit / Reject proposals; conflict-checked undo and activity are encrypted with the workspace.
- Local income, expenses, invoices, statement CSV import, user-confirmed classification and reconciliation. Existing money/tax/reconciliation calculations remain deterministic.
- Monthly, client, source, category and account analysis; duplicates, unexplained balances, unmatched Sent invoices and unusual charges. Saving estimates use the customer's own records, with sources and review actions.
- Local Filing Pack PDF; Excel, CSV and PDF report exports; existing tax worksheet JSON. Chat document cards preserve a snapshot and offer local preparation, download and native file sharing where supported. Invoice printing remains available; an invoice-specific PDF from chat currently needs a single invoice in the selected year.
- Encrypted current/recent chats, editable profile memory, and user-provided IRIS codes labelled **From you, not verified**. Removing an IRIS memory removes its dynamic presentation from help answers. No verified IRIS code is fabricated.
- Optional **Qwen3-1.7B on device**, lazy-loaded in a worker through pinned WebLLM. Settings explains the approximately 1.4 GB model download, compatible WebGPU requirement and approximately 2 GB GPU memory. Guided chat remains available on smaller phones. The model selects allowed intents/definitions; it cannot calculate liabilities, invent codes or write records. The browser-GPU path requires device verification; automated checks cover build, routing contracts and fallback paths.
- Settings offers an offline app-shell download and local calendar reminders for monthly statements and statutory filing dates. Calendar software controls notifications. Check FBR for extensions.

## Run and check

```sh
npm ci
npm run dev
npm test
npm run build
npm audit --omit=dev --audit-level=high
node --import tsx --test server/test/*.test.ts
npm run preview
```

The production build is static and publishes through GitHub Pages on a push to `main`. AI, PDF and Excel code are loaded on demand. `dist/` contains the generated site and offline shell worker.

For the developer's localhost Ollama router:

```sh
ollama pull qwen3:1.7b
npm run dev:assistant
```

Ollama must be installed separately. The local gateway binds to loopback, never to the public internet. It is not a hosted multi-user API.

## Privacy and tax boundaries

Records, chats, memories, file snapshots and proposal activity use the existing AES-GCM vault. The unsaved demo lives in memory. Locking clears decrypted state and terminates the on-device model. Back up the encrypted workspace; a forgotten passphrase has no publisher reset.

Optional model downloads expose an IP address to Hugging Face/GitHub, never chat content. `Never touch the network` blocks downloads, reference rates and localhost routing; an already-loaded on-device model can still run locally. No browser API key or private-data training endpoint exists. Personal history is context, not automatic shared-model fine-tuning.

Tax answers use the checked application rule register for supported TY 2026/2027 scenarios, with eligibility gates and FBR sources. Estimates need review. Hisaab does not submit returns, pay tax, verify taxpayer status or claim complete current-law coverage. All catalogue IRIS codes remain unavailable until exact tax-year provenance is supplied and checked.

See [SECURITY.md](SECURITY.md), [privacy](docs/PRIVACY.md), [tax rules](docs/TAX-RULES.md), [IRIS map](docs/IRIS-MAP.md), and [design](DESIGN.md).

## Connected web backend

Hisaab now has a provisioned Free Supabase project with company-scoped RLS, Owner/Editor/Viewer database roles, encrypted sync RPCs, a hosted finance gateway and a scheduled Web Push sender. Account, company and notification controls are in Settings and the sidebar. The frontend uses only a public publishable key; private credentials remain in server secrets.

Google OAuth is enabled and the OpenRouter key is saved as `AI_API_KEY`. The configured OAuth endpoint redirects to Google with the expected callback; a full user login still needs browser verification. The server pins a free, zero-retention-eligible model route and refuses paid fallbacks. Live model requests currently fail with upstream HTTP 429 from the serving provider; hosted AI is not ready merely because its key is configured. Guided local tools continue to work. The free provider account has a shared daily quota, so this is a limited pilot, not unlimited public compute.

See [cloud setup and boundaries](docs/CLOUD-SETUP.md). Company member invitations, per-member key distribution, Gmail imports and self-service cloud company deletion remain unfinished. Company grouping does not add corporate/AOP tax calculations: the existing tax rules support selected individual freelancer scenarios only.

The legacy `server/` Worker is a separate optional service and continues rejecting plaintext ledger fields. The new Supabase service stores encrypted envelopes and separate account/membership/delivery metadata. Never put personal secrets in the browser bundle or Git.

The editable assistant policy is in `supabase/functions/finance-chat/policy.ts`; local routing is in `src/assistant-contract.ts`, checked explanations in `src/tax-help.ts`, calculations in `src/core.ts`, and verified IRIS retrieval in `src/iris-assistant.ts`. Improve these using reviewed sources and synthetic multilingual tests. Private history is context, not automatic shared-model training.
