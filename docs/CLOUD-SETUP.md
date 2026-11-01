# Hisaab connected web setup

Project: `smdyzfqhborabxqslkye` (Hisaab, Free organization, Mumbai).
Frontend: https://haiderimran019.github.io/Hisaab/

## Owner setup

1. In Google Auth Platform, create a Web application client. Use JavaScript origin `https://haiderimran019.github.io` and redirect URI `https://smdyzfqhborabxqslkye.supabase.co/auth/v1/callback`.
2. Use only OpenID, email and profile scopes for sign-in. Set the appropriate External audience; a Testing app permits only its test users. Public branding/audience requirements are separate from saving a client.
3. In Supabase Authentication → Providers → Google, enable Google and store the client ID and secret. Never put the secret in the frontend, repository or chat.
4. In Authentication → URL Configuration, set the Site URL and allowed redirect to `https://haiderimran019.github.io/Hisaab/`.
5. In Edge Functions → Secrets, set `AI_API_KEY` to an OpenRouter key. The server pins `xingchen-agi/xing4.0-29b-a4b:free` through Phala, which was listed as a free zero-retention endpoint when checked. `AI_MODEL` is not required or read. Model availability and language quality must be verified with real inference. The gateway rejects paid model IDs and requests no-data-collection/zero-retention providers. No eligible provider means a safe failure, not relaxed privacy.
6. Verify the complete Google redirect/login, company creation, encrypted sync and hosted model answer. A configured secret alone does not establish that inference works.

OpenRouter's currently documented unfunded allowance for free variants is 50 requests/day across the provider account. Hisaab also limits each authenticated user to 20 requests/hour across their companies. These are pilot limits, not unlimited public capacity. No credits or paid upgrade have been enabled.

## Architecture

The browser retains the existing AES-GCM vault and deterministic financial functions. Supabase stores account identity, company membership, encrypted vault envelopes, reminder subscriptions and non-content rate counters. Plaintext financial tables and server-side model calculations are not introduced.

`src/cloud-config.ts` contains only the project URL and public publishable key. `src/cloud.ts` lazy-loads the SDK after a deliberate connection. Tokens and non-financial sync bindings are tab-scoped. Google identity controls access; the user's workspace passphrase decrypts books.

A company has one current encrypted envelope, including that workspace's chats and memory. Members who possess its passphrase can decrypt all of it; keep personal notes outside a shared company workspace. The revision RPC rejects stale saves; local changes remain safe on conflict. Sync is enabled after a deliberate successful upload and pauses on lock, sign-out, company changes or network-off. It transfers the full bounded envelope, not an incremental collaborative document.

### Company security

- `companies`: metadata readable only by members.
- `company_memberships`: authoritative role records. A frontend user cannot add themselves to another company or change their role.
- `encrypted_workspaces`: `company_id` primary key; Owner/Editor writes, Viewer reads; immutable company scope and revision checking.
- `push_subscriptions`: both company and user ownership. A member cannot access another member's browser endpoint.
- `ai_rate_limits`: server-owned global user quota with company context; frontend users have no access.
- `hisaab_private.push_config`: global service configuration, not customer data; server-only key access.

The narrow private definer functions bootstrap a fresh company and look up only the current user's membership role. They use empty search paths, explicit auth checks and restricted execution. JWT user metadata never supplies company permissions. Shared FBR rules are a reviewed public catalogue, not tenant-owned data.

Company invitations, delegated key distribution and self-service cloud company deletion are not implemented. Ownership/membership administration needs a separate reviewed workflow. A teammate needs the workspace unlock secret separately; a DB role is not an encryption key.

## Push reminders

The deployed `send-reminders` function exposes only a public VAPID key through GET. Its POST requires a private dispatcher token. A database Cron job calls it at 04:00 UTC (09:00 Pakistan time). Monthly notices are eligible on the first day of the month; filing check-ins use the existing statutory-date schedule and tell users to check FBR extensions.

The server checks current membership and allows only known browser push-service hosts. Delivery claims prevent duplicate sends on one day. Notices contain generic copy, the Hisaab name and round ح icon. The operating system controls notification typography. Actual delivery requires browser permission, supported device capabilities and a saved real subscription; a zero-recipient dispatch does not prove device delivery.

## IRIS knowledge

`src/iris-assistant.ts` retrieves only tax-year-specific verified entries from `src/iris.ts`. Values come from the existing estimate functions. Each entry needs the exact IRIS label/path/code, source, checked date and reviewer. Transcribe from a real matching return screen or official return-form SRO; keep private taxpayer figures out of the catalogue. No live codes are invented or inferred from the model.

Run `npm run iris:check`. It lists missing codes by year and fails on incomplete verification claims. User-provided codes remain separate, editable encrypted memory labelled From you, not verified. Real catalogue codes remain unavailable until human source verification.

## Verification and operations

- `npm test`, `npm run test:service`, `npm run build`, production dependency audit.
- `supabase/tests/company-isolation.sql`: synthetic transaction tests; all fixtures roll back.
- Live smoke checks: real synthetic Auth sessions, REST/RPC company isolation, encrypted save/download/unlock and stale-write rejection; test accounts must be removed afterward.
- Run Supabase security/performance advisors after schema changes. These are lint checks, not an independent audit.
- Deployed functions perform their own authentication (`verify_jwt=false` supports preflights and current signing keys): Auth.getUser + company RLS for chat; dispatcher secret for push POST.
- The existing Cloudflare `server/` is a separate legacy optional service. It is not the new sync backend.

Gmail transaction imports are not enabled. They require separate restricted-scope consent, verification and a per-user token/retention design. Sign-in deliberately does not request Gmail permissions. Financial data processing and professional tax/security review remain necessary before calling this an unrestricted production finance service.

## Deployment check — 1 November 2026

Google is enabled in the public Auth configuration. The authorize endpoint returns a redirect to Google with the expected Supabase callback. The allowed app redirect is saved. Full browser login has not been verified in this change.

`AI_API_KEY` is saved. Real synthetic inference reached the serving provider but returned upstream HTTP 429 (rate limit). No paid fallback or relaxed retention policy was enabled. Hosted AI is pending provider availability; the local deterministic assistant remains usable.

App tests: 219 passed; legacy service tests: 67 passed; production build passed; production dependency audit: zero vulnerabilities. Live JWT REST/RPC checks passed company isolation, encrypted round-trip and stale-write rejection. SQL role tests passed. Synthetic Auth users and their companies were removed after testing.

Database advisors found no RLS policy errors or missing foreign-key indexes. Auth still reports the default leaked-password-protection warning; Google is the exposed app login method. Unused-index information is expected on this new project. These checks do not replace an independent security audit.

Push dispatch was tested with no recipients. Real device delivery remains unverified. The current sender processes at most 200 unsent subscriptions per daily dispatch; queue pagination and delivery retries are required before a larger rollout.
