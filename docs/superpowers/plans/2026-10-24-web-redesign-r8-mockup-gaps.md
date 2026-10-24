# Web redesign R8 — Mockup gaps — Record

**Goal:** Close the gaps between the web app after R1–R7 and the chosen redesign mockups.

**Method:**
1. A comparison of each mockup with screenshots of the real app found what is missing. Each area had one agent.
2. Seven agents closed the gaps, one for each area, each in its own worktree:
   - Home
   - Shell
   - Transactions
   - Statistics
   - Accounts
   - Profile and Admin
   - Empty states
3. The branches were merged into `redesign/web`.

This file records the scope and the decisions. The work is done, so this file has no task steps.

**Spec:** `docs/superpowers/specs/2026-10-20-web-home-redesign.html` and `2026-10-21-web-pages-redesign.html`. The spec wins over the mockups.

**Mockups (not in the repository):** `docs/design/redesign/` (`home-final.html`, `transactions.html`, `stats.html`, `accounts.html`, `profile.html`, `empty.html`).

**Branch:** `redesign/web`.

---

## Bugs fixed

- **The sign of a goal's status.** An on-track goal behind its pace read «−13,61 € avanti». It now reads «nei tempi», and the panel reads «Sei nei tempi.». The regression test is `packages/i18n/src/goalText.test.ts`.
- **The account in a transaction row.** The spec shows «Category · Account · #tag», but the row showed only the category. The web `listView` adds the account. The account is not shown when the list is filtered to that account. Mobile is not changed.
- **The ring tone over pace.** H12: the fill stays grey over pace, and the accent shows only over the limit. `budgetTone` and the Transactions expense bar now follow H12.

## Scope by area

- **Shell:**
  - `PeriodHeader` is one row: «‹ 1 – 30 settembre › giorno 13 di 30» (`formatPeriodRange`).
  - The page uses the new token `canvas` and the blocks use `card`.
  - Only the Home hero figure has faint cents (`faintCents`).
  - Filled buttons use the text colour.
  - Zero income is neutral.
- **Home:**
  - The chart has a visible title.
  - The «In arrivo» count is on its own line.
  - A budget tile shows «{spent} di {limit}» (`targets.spentOf`).
  - A goal row shows «{saved} di {target}» (`goals.savedOf`).
- **Transactions:**
  - «Dettagli» is one row that opens. It is open by default when the transaction has a tag, is excluded or repeats.
  - The toast «Modifiche salvate» shows after an edit.
  - The day totals have a sign.
  - The phone summary puts Expenses full width, then Income and Upcoming side by side.
- **Statistics:**
  - The chart has a legend and a 15px title.
  - «Ripartizione» shows its total and the category count.
  - «Quota impegnata» has a two-tone bar.
  - On a phone, each category shows its share and its change.
  - The share bars are relative to the largest category.
  - The category dialog has the icon, six bars with the dashed median, and «Tutte ›».
  - A forecast period has the status «previsione».
  - The tooltips are fuller.
  - The Expenses/Income switch is a segmented control (`SegmentedLinks`).
- **Accounts:**
  - The Goals block has «+ Nuovo obiettivo».
  - The net worth chart is 120px, with an area and the month names (`NetWorthChart`).
  - The panel head has an icon.
  - A sub-line under the balance shows the bank, the type and the free amount.
  - The action buttons have icons. «Modifica» is the filled button. «Accantona» and «Preleva» are full-width buttons.
  - The goal sub-line shows the deadline.
  - Entrate and Uscite are in tiles. The account rows have icon tiles.
- **Profile and Admin:**
  - The edit dialogs show their title.
  - Categorie has an Uscite/Entrate switch (`?d=income`).
  - Profilo shows Nome with «Modifica» (a new server write), Email and Ruolo.
  - The rows of Admin → Account have a second line.
  - At 390px, the groups are in boxes with hints.
  - The sections use `SettingsSection` and `SettingsBox`.
  - An active invite has an inline «Revoca».
  - «Nuovo invito» has the label «Scade dopo».
- **Empty states:**
  - On first use, Transactions shows only the quick add.
  - Four empty states have lead sentences.
  - The type tiles and the preset tiles use `PickTile`.
  - A search with no result lists the matches in other periods: up to 3 periods, and up to 3 rows in each period.
  - «Per iniziare» has a progress bar.
  - «Nei tuoi conti» shows one total.
  - The budget suggestions are in a box, with the median note and the counts.
  - The quick add has the CSV row.
  - The empty block of Statistics is above the chart. A calendar month is shown by its name.
  - The forms for the first tag and the first invite are compact.
  - The goal presets have the row «Qualcos'altro?».
  - With no account, the net worth block does not show.

## Decisions

- **The Panel head has one slot for an icon.** Three branches added their own slot. The merge keeps `icon` on `Panel` and `PanelSpec`. A body that is `bare` does not show the icon.
- **The category dialog shows six bars.** The spec says «the last six periods». The mockup has seven.
- **The Transactions summary follows the search and the filters.** The user decided this on 2026-10-24. Before, the summary showed the whole period, and a search with no match showed «0 transazioni» next to the period's Uscite. `listView` returns `summary`, and the spec says so in section 05.
- **The web form has no Note field.** The user decided this on 2026-10-24. The POC rule §17.1.9 stays.
- **The site keeps a 64px top bar.** The new token `siteTopbarHeight` holds it, because the app's `topbarHeight` is 56.
- **The Home budget tile shows the € sign only on the limit** («449,37 di 450,00 €»), as in spec figure 4.
- **The count of a budget suggestion uses `transactions.periodCount`** («61 transazioni»). The mockup says «61 voci».
- **The lead of Categorie says «transazioni»**, because the list also shows income.
- **The colours `canvas` and `card` are web tokens.** Mobile does not read them. The existing token values do not change.

## Command palette review

A review of the palette before the merge found nothing serious. These fixes are in:

- The rows of an older query are disabled while the new query runs.
- `amountQuery` reads `,05` as 0,05 €.
- The input stops at `MAX_SEARCH_QUERY`.
- A held ⌘K does nothing more.
- The «See all» group has a name.

These items stay open:

- The search action has no rate limit. A signed-in script can load only its own data.
- `normalizeText` does not fold ß, ø, ł and æ. The Transactions filter has the same limit.

## Open items

- The period head sits about 16px lower than in the mockup, because the shell's top padding comes first.
