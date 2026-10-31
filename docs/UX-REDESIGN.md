# Current redesign brief — 31 October 2026

This user-supplied brief replaces earlier design plans. Slice 1 is in progress;
stop after its checks and screenshots. Later slices require user approval.

NEW DIRECTION. This replaces the earlier design plan. Build Hisaab as a chat-first app in a dark, messaging style (like Meta's Muse). Do not reuse the old dashboard look anywhere. Do not change money, tax, encryption or reconciliation logic. Keep all tests passing.

1. DESIGN TOKENS (define in src/tokens.css; use them everywhere and remove the old palette)
Dark (reference theme):
--bg #141515 · --surface #1E2020 · --surface-raised #272A2A · --border #34383A · --border-soft #2E3133
--text #F3F3EF · --text-muted #A8ADAA
--accent #2563EB (primary buttons, send button, user message bubbles; white text)
--money-in #7BD69A (only for money that arrived and savings)
--alert #E8BD68 · --alert-surface #221F17 · --alert-border #5A4A2A (only for "needs attention")
--avatar-bg #E9DCC4 · --avatar-ink #3A2E1E
Light: same roles, derived from the dark theme, WCAG AA. Theme follows the device; dark is designed first.
Font: Figtree (self-hosted via @fontsource-variable/figtree), weights 400/500/600/700, for everything including headings. Remove Poppins and the serif.
Radius: bubbles 20px (6px on the tail corner), cards 20px, chips and buttons fully rounded, small items 12px.
Spacing: 4/8/12/16/20/24px. Tap targets at least 44px. Hairline 1px borders, no shadows, no gradients.
Avatar: a round badge with the Urdu letter "ح" (no character art).

2. SCREENS
A) Home (empty state):
- Top bar: menu button (left), "Hisaab" (centre), new-chat button (right).
- Centre: avatar 64px, heading "What would you like to sort out?" (28px), month line in muted text.
- 3 stacked tappable cards (20px radius) with live figures from existing functions:
  · Reached you this month (amount in --money-in, plus "after Rs X lost to fees")
  · Keep aside for tax (amount, plus rate and "estimate")
  · Needs your attention (alert style: count of unclassified lines / unexplained difference)
  Tapping a card opens a chat showing that figure and its records.
- Above the composer: 3 suggestion chips ("I got paid $500", "Where am I losing money?", "Tax kitna banega?").
- Composer pinned at the bottom: rounded pill (--surface-raised) with a "+" button (attach statement/document), an input "Tell Hisaab what happened", and a round --accent send button.
- Nothing else on home.

B) Active chat:
- After the first message or card tap, the cards and chips disappear. Only the messages and composer remain.
- User messages: right-aligned --accent bubbles. Assistant: small avatar plus a left-aligned --surface-raised bubble.
- Short replies, quick-answer chips under a question (e.g. Payoneer / Meezan Bank / Wise).

C) Proposal card (in chat):
- "Proposed · not saved yet" label, title (e.g. "Record a payment"), a two-column list (From, Amount, Fee, Rate, Date, Reached you in --money-in).
- "Why:" line and "Sources:" line with links to the exact statement rows and documents.
- Buttons: Confirm (full-width --accent) · Edit · Reject.
- After confirm: a compact "Recorded · Rs X" row with a check icon and an Undo button.

D) Saving tips (in chat):
- One-line answer with the total, then a card with fee per receiving method (Payoneer, Wise, bank): % and Rs, plus a thin bar per method, the worst in --alert.
- One line with the possible saving in --money-in, "From N receipts · estimate, not financial advice", and a "Show the N receipts" button.
- Optional small tip card, e.g. PSEB 1% → 0.25%, with "needs review".

E) Filing Pack (in chat):
- One-line answer, then a document card: a light page preview on top (title, tax year, unresolved and "Not reviewed" tags, key totals), a PDF row (name, pages), then "Share to WhatsApp" (primary) and "Download".
- Under it: "A worksheet for your accountant or IRIS, not a filed return" plus the due date.

F) Sidebar (slide-over from the menu button, 320px):
- Logo row with an "AI on this device" / "AI off" badge, a New chat button, Recent chats (title + date, current one highlighted), "What I remember" (each item with a forget button), a Records grid (Income, Expenses, Invoices, Statements, Tax, Filing Pack → existing screens), and Privacy and Settings at the bottom.

3. BEHAVIOUR, AI ENGINE, DATA (as agreed before)
- The assistant never writes data. Only Confirm saves, through the existing validated save paths. No duplicate confirms; edit invalidates; undo with a conflict check.
- Every number comes from existing deterministic functions or the new pure src/insights.ts. The model never calculates.
- Fixed intent list. Off-topic gets "Sorry, I can only help with your Hisaab records, tax and money." plus 2 chips. Replies are max 2 sentences. One clarifying question when unclear.
- English, Roman Urdu and Urdu input. PKR default, lakh formatting (Rs 1,36,416). DD/MM/YYYY dates. Pakistani banks and Payoneer/Wise/JazzCash/Easypaisa/Raast presets.
- AI: Layer 1 guided rules by default (free, offline). Layer 2 optional WebLLM Qwen3 1.7B in a Web Worker with silent fallback. No cloud, no keys, no cost.
- Chats, memory and the activity log are stored inside the encrypted workspace. "Never touch the network" blocks model downloads.

4. CURRENT REVIEW BATCH — NOT YET APPROVED

The user rejected the earlier token pass. Correct the shared header, composer,
Filing Pack document and all records screens before requesting approval. Header:
menu · title · new chat only. Theme lives in Settings. Demo data is a muted line;
tax year is a small picker chip. No main-screen accordions, nested panels, heavy
shadows or coloured warning boxes. Amber applies only to a warning icon and its
action. Green applies only to received money or demonstrated savings.

The new Analysis slice adds a pure `src/analysis.ts` over the existing workspace.
It must use receiptMath, expenseMath, reconcile and estimate without changing them.
Periods and native account currencies remain explicit; withholding is never
called money kept aside. Recurring totals are observed, not invented forecasts.
Every analysis card links to source records and offers one review proposal.
Statement and document text is untrusted data, never assistant instructions.

Current correction includes local analysis routing and review-only proposals;
financial write proposals and conflict-checked record undo remain slice 4. A
review proposal only opens records, and explicitly says it does not change them.
The current conversation, proposal decisions and pack notes use bounded encrypted
workspace metadata. Starting a new chat clears it; recent-chat archives come in
slice 10. No memory facts or AI inference have been enabled.

IRIS entries are tax-year specific. Verified entries require a verified code,
exact field label, path, source (`IRIS screen` or `FBR return form SRO …`), checkedOn
and checkedBy. Build and tests reject incomplete provenance. Unverified codes and
paths must never be offered as filing destinations. User-provided codes remain
separate, labelled “From you, not verified”; encrypted memory and the filing
walkthrough are later slices, with explicit consent before remembering facts.

5. APPROVAL ORDER (do not mark a slice approved on behalf of the user)

1. Tokens and Figtree; remove the old palette.
2. Home and shell, composer and sidebar.
3. Chat and guided rules (English, Roman Urdu, Urdu).
4. Financial proposal cards, validated save, activity and conflict-checked undo.
5. Saving tips from deterministic insights.
6. Filing Pack document card and local PDF share/download.
7. Files: local PDF, lazy pinned XLSX, CSV, JSON; report-total tests.
8. Tax help and savings: existing rule register, law, rule version and FBR source;
   eligibility gates; estimate, not tax advice.
9. IRIS filing helper: verified year-specific map only; unknown code asks user;
   user-given code always unverified, encrypted, editable and deletable; filing mode.
10. Memory and recent chats: one short question, save only after yes, visible source
    and date; memory cannot override a verified rule; conflicts flagged for review.
11. Optional on-device AI and privacy update. Guided mode stays available offline;
    no cloud keys. Never touch the network blocks optional downloads.

Analysis is an additional requested review slice; its numbered placement has not
been supplied by the user. Keep it separate from approval of the numbered slices.

After each approved scope: npm test, npm run build, focused checks and real mobile
(390px) and desktop screenshots. The current review additionally requires Home,
active chat, proposal, Filing Pack, Statements, Tax, Sidebar and Settings in both
themes. Stop for user review; do not advance automatically.

## New owner request — free Qwen3-1.7B foundation

The owner approved the visual direction and requested a free model, Google
identity/sync, private persistent history, memory, exports, charts and reminders.
The final selected model is Qwen3-1.7B, replacing the earlier 8B/on-device-only
proposal. The current prototype runs Ollama on the owner's Mac and has no public
model endpoint or paid API. All actual money/tax logic remains deterministic.
Recent/all chats, editable memory/onboarding, charts, free preview entitlements
and local XLSX are implemented; browser visual verification is blocked because
browser access to both Google Cloud and localhost was denied. Do not use another
browser surface to bypass the denial or claim new screenshots were checked.

At that prototype checkpoint, Google login, encrypted revisioned sync, Gmail, notifications, financial write
proposals with record undo, broader reviewed tax retrieval and chat document
cards remained unfinished. The release update below supersedes that status. Never claim the prototype knows all current laws or
verified IRIS codes. Product-specific improvement uses private per-user history
and confirmed memory; shared training on private chats/email is not enabled.

## Release implementation update

The user authorized publication of the current product to main. Chat record forms now produce user-confirmed snapshots, conflict-checked undo and encrypted activity; local file snapshots render document cards; deterministic saving estimates and recent chats are available. On-device Qwen3-1.7B is a consented, lazy worker download. Profile and user-provided IRIS memory are editable/deletable. Calendar reminders and an optional offline shell cache require an explicit user action.

Fresh browser/screenshots and device-GPU inference verification remain blocked by Codex's saved browser-origin permission. Google OAuth/sync/Gmail and hosted model services remain unconfigured. Prior screenshots are historical evidence, not proof of this release.
