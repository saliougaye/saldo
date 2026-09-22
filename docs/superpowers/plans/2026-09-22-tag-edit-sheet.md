# Tag edit: sheet, with merge as its own action (2026-09-22)

Mockups: `docs/superpowers/mockups/2026-09-22-tag-edit-variants.html` (variants A–D, then A1/A2).
Chosen: **A1**.

## Why

The tag screen opened with a card of controls (name, Save, Delete, a merge chip per tag) above the
total, pushing the figures the screen is for halfway down. Worse, a tap on a merge chip merged at
once: irreversible, rewriting every transaction the tag carries, one mis-hit away.

## Decisions

- **Edit is a sheet** (§6.24 "Tag edit sheet"), the twin of "Nuovo tag": title, Name, Save, Cancel.
- **Delete starts in the edit**, as in every other edit of the app ("Elimina tag" under a divider),
  but is confirmed in a **bottom sheet of its own** ("Eliminare «X»?" · "Le N transazioni che lo
  portano restano, senza questo tag." · Elimina / Annulla), the same shape as merge. This departs
  from §5.10's "confirm inline" by the user's decision (2026-09-22, after trying the inline one):
  the two irreversible actions share one confirmation. The edit sheet closes first and the delete
  sheet opens on its `onDismissed`, since iOS drops a modal presented while another dismisses.
- **Merge is a separate action** with its own sheet: pick a tag (a check, no side effect), read
  what will happen ("Le N transazioni di «X» passeranno a «Y»… Non si può annullare."), confirm
  with "Unisci". Hidden when there is no other tag.
- **Entry points in the header**: merge icon (Lucide `merge`) + pencil, as `HeaderIconButton`s.
  A2 (a merge row under the total) was rejected as giving merging too much weight.

## Steps

- [x] Lucide 1.47.0 `merge` added to `@saldo/ui` icons.
- [x] i18n: `tags.merge`, `tags.mergeTitle`, `tags.mergeNote_{one,other}`, `tags.mergeNoteUnused`.
- [x] `TagEditSheet` (+ tests) replaces `TagEditCard`.
- [x] `MergeTagSheet` (+ tests).
- [x] `DeleteTagSheet` (+ tests); i18n `tags.deleteTitle`, `tags.deleteNote_{one,other}`, `tags.deleteNoteUnused` replace `tags.deleteConfirm`.
- [x] `HeaderIconButton` in `ScreenHeader.tsx`; `app/tag/[id].tsx` wires both sheets.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` green.
- [x] Manual test on device (user, 2026-09-22).
