# Visual contract

## Current direction — exact Muse messaging spec, 31 October 2026

The user-supplied specification in `docs/UX-REDESIGN.md` replaces every earlier
design plan. The current correction batch is awaiting user approval. It includes
the shared screen audit, Filing Pack document and the additionally requested
Analysis module with local chat routing. Review proposals only open records;
financial save proposals and record undo remain in slice 4. The complete updated
11-slice order is in docs/UX-REDESIGN.md. Do not advance without approval.

## Reference dark palette

All colours live in `src/tokens.css`. Existing names such as `--line`, `--ink`,
`--muted` are compatibility aliases, not retained palettes.

| Role | Dark reference | Derived light |
| --- | --- | --- |
| `--bg` | `#141515` | `#f7f8f7` |
| `--surface` | `#1e2020` | `#ffffff` |
| `--surface-raised` | `#272a2a` | `#eff2f0` |
| `--border` | `#34383a` | `#d7dcda` |
| `--border-soft` | `#2e3133` | `#e5e9e7` |
| `--text` | `#f3f3ef` | `#202624` |
| `--text-muted` | `#a8adaa` | `#58635d` |
| `--accent` | `#2563eb` | `#2563eb` |
| `--money-in` | `#7bd69a` | `#237a43` |
| `--alert` | `#e8bd68` | `#815507` |
| `--alert-surface` | `#221f17` | `#fff8e8` |
| `--alert-border` | `#5a4a2a` | `#d8bd84` |
| `--avatar-bg` | `#e9dcc4` | `#e9dcc4` |
| `--avatar-ink` | `#3a2e1e` | `#3a2e1e` |

Dark is the reference theme. Follow the device by default and preserve an
explicit saved override. Accent controls use white text. Incoming money and
savings alone use green; unresolved records use the attention roles. Stronger
control-boundary and focus roles support WCAG AA without thick decorative lines.

Figtree is self-hosted from `@fontsource-variable/figtree`, weights 400/500/600/700,
for UI, headings and codes. Remove Poppins, serif and monospace dependencies. The
avatar is a round beige badge containing ح, not character artwork. System font
fallback supplies Urdu glyphs not covered by Figtree.

- Bubbles: 20px, with a 6px tail corner. Cards: 20px. Small items: 12px.
- Chips and buttons: fully rounded. Tap targets: at least 44px.
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24px.
- Hairline borders only. No shadows or gradients. Respect reduced motion.
- Keep the 720px centered desktop column and responsive phone layout.
- Keep the UI concise. Financial sources, eligibility gates and estimate limits
  must remain reachable; avoid repetitive explanatory copy.

`style.css` owns controls/forms/records, `studio.css` composition, `print.css`
print layout. Financial functions are unchanged. The PDF document uses the
existing Filing Pack data, generated locally by a pinned, lazy-loaded library.
The shared header is menu · title · new chat. Theme belongs only in Settings.
The composer is pinned on every screen. Show warnings as neutral text with an
amber icon and action; no nested cards or main-screen accordions.

## Gate

Run npm test and npm run build. Capture Home, active chat, review proposal,
Filing Pack, Statements, Tax, Sidebar and Settings at 1440px desktop and 390px
phone widths in light and dark. Audit Income, Expenses, Invoices and Privacy too.
Check fonts, exact dark roles, contrast, targets, overflow, one primary action,
actionable warnings and the absence of old colours. Stop for user approval.

Money, tax, encryption and reconciliation logic must not change. Every later
record proposal requires user confirmation. No cloud AI, keys or paid models.

## Connected settings update

The owner authorized full-product work and accepted the previous browser checks. Account/company selection, privacy previews and reminder controls use the existing tokens and small Settings surfaces. The round ح avatar is also used in the PWA/notification assets. Notifications outside the app use OS typography. Company switching pauses sync and does not silently replace local books.
