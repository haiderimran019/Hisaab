# Visual contract

## Current direction (22 October 2026)

**Light by default, dark on request.** This is a tool people open in daylight, on
a cheap phone, often outdoors — and the Filing Pack it produces is ink on paper.
Dark follows the device setting and can be forced either way from Settings; the
choice lives in plain browser storage so it applies on the lock screen too.

**White first.** The page and every card are white or within a shade of it,
separated by a hairline and the faintest lift rather than by blocks of grey.
Rounded corners, generous padding, soft shadows in light and plain borders in
dark, where shadows disappear.

**Brand is a soft indigo; money keeps its own language.** An earlier palette used
one orange for the primary action, the selected tab, a pending decision and an
unexplained difference — when everything is the same colour, nothing reads as
what it is. Indigo is the interface. Green arrives, red leaves, amber wants your
attention, red is a problem. Those four never borrow the brand's colour and the
brand never borrows theirs.

**Tokens, not hex.** Every surface, line, text and state colour is a semantic
custom property defined once per theme (`--bg`, `--surface`, `--line`, `--ink`,
`--muted`, `--brand`, `--on-brand`, `--warn-*`, `--danger-*`, `--ok-*`, `--info-*`,
`--shadow`, `--radius*`). The stylesheet names roles, never colours, so a theme is a block of
variables rather than a sweep through the file.

**The printed sheet is exempt.** `.invoice-paper`, the Filing Pack and everything
inside `@media print` stay ink on paper in both themes. An invoice should not
change colour because of a display preference.

Poppins throughout. Flat surfaces, 3px corners, hairline borders, no gradients.
Consistent Lucide stroke icons at one weight. No illustrative stock art. All
example amounts explicitly belong to the Demo workspace.

## Layout

Four destinations — Today, Money, Tax, Filing Pack — plus Settings and the
privacy notice. Record types (income, expenses, invoices, statement lines) are
tabs inside Money, not top-level navigation. One Add action is reachable from
every page, and from the middle of the bar on a phone.

Desktop: persistent left rail, quiet utility header. Phone: the same content with
wide tables stacked into labelled cards rather than scrolled sideways.

## History

The original brief fixed charcoal surfaces with orange accents, taken from a
supplied reference. That held until 22 October 2026, when the founder asked for a
palette that reads welcoming, fresh and trustworthy. The charcoal/orange scheme is
recorded in `PRODUCT.md` as the original commitment; this document supersedes it
for colour. Poppins, the responsive contract and the honesty rules are unchanged.
