# Goals B2 — screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the user sees of goals (spec §5.13, §5.14, §6.1, §6.5, §6.8, §6.35–6.38): the Obiettivi target card on Home, the list, the detail with «Accantona» / «Preleva», the wizard, the close sheet, the pockets under their parent in Conti, and the notification when a goal is reached.

**Architecture:** Built on Plan B1 (`goalProgress`, `rankGoal`, `goalAdvice`, `createGoal`, `closeGoal`, pocket helpers) and Plan A (`FeaturedTarget`, `SeeAllRow`, `TargetRing`). One pure mapper, `goalViews`, turns accounts and transactions into `GoalView`s; one hook, `useGoalText`, owns every string a goal renders, so card, list and detail cannot disagree. Transfers and the closing expense open the ordinary transaction sheet through route params, as «Salda carta» does.

**Tech Stack:** TypeScript strict, Expo Router, react-i18next (`Trans`), jest-expo + React Native Testing Library.

**Decisions recorded here (AGENTS.md):**

- **A deadline in the current year reads as a day («entro 15 ott»), a later one as a month («entro giugno 2027»).**
- **The goals list reuses `FeaturedTarget` in a card per goal**: §6.35 asks for icon, name, deadline, saved over target, bar with tick and the sentence — exactly that block.
- **«Registra la spesa» closes the goal when the expense is saved**, not before: the sheet carries `closeGoal={id}`, and cancelling the sheet leaves the goal open. What the expense did not use goes back to the parent (`closeGoal`).
- **«Accantona» and «Preleva» reuse `settlementForm`'s params** (`settleTo`, `from`, `description`): a transfer prefilled between parent and pocket is the same shape as a card settlement, without the shortcuts.
- **Reached-goal notifications are once per goal, ever** (kv `goalReached:{id}`), as §5.14 says; a goal reached before this build notifies once on first launch.
- **Hidden mode**: the Home card and the goal detail show amounts, following the Home rule of Plan A; the notification title masks (a lock-screen banner is what hiding is for, as the card reminders do).

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/components/TargetRing.tsx`, `ProgressBar.tsx` | `done` tone (green) |
| `apps/mobile/src/features/targets/FeaturedTarget.tsx` | `done` tone, optional `onPress` |
| `packages/i18n/src/locales/*.ts` | `goals` namespace |
| `apps/mobile/src/features/goals/goalViews.ts` / `.test.ts` | pure mapper |
| `apps/mobile/src/features/goals/useGoalViews.ts` | data hook |
| `apps/mobile/src/features/goals/useGoalText.tsx` | statuses, metas, sentences, labels |
| `apps/mobile/src/features/goals/HomeGoalsCard.tsx` / `.test.tsx` | the Obiettivi target card |
| `apps/mobile/src/features/goals/goalAlerts.ts` / `.test.ts`, `GoalAlertsGate.tsx` | reached notification |
| `apps/mobile/app/(tabs)/index.tsx` | card + gate on Home |
| `apps/mobile/src/features/goals/goalLinks.ts` / `.test.ts` | transfer and expense params |
| `apps/mobile/app/transaction/new.tsx` | closing expense |
| `apps/mobile/src/features/goals/goalFormValues.ts`, `steps.ts` / `steps.test.ts`, `GoalForm.tsx` | wizard |
| `apps/mobile/app/goal/new.tsx`, `apps/mobile/app/goal/edit/[id].tsx` | create, edit |
| `apps/mobile/src/features/goals/GoalCloseSheet.tsx` | close sheet |
| `apps/mobile/app/goal/[id].tsx` | detail |
| `apps/mobile/app/goals.tsx` | list |
| `apps/mobile/app/(tabs)/accounts.tsx`, `app/account/[id].tsx`, `app/settings/archived-accounts.tsx`, `app/profile.tsx` | Conti nesting, redirect, Profile row |

---

### Task 1: The `done` tone

**Files:**
- Modify: `apps/mobile/src/components/TargetRing.tsx`, `apps/mobile/src/components/ProgressBar.tsx`, `apps/mobile/src/features/targets/FeaturedTarget.tsx`

- [ ] **Step 1: Ring**

In `TargetRing.tsx`, change the tone type and its doc:

```ts
/**
 * `attention`: over pace or over the limit (a budget), behind or expired (a goal). `done`: a goal
 * reached — the only green (§5.13). Colour carries the meaning, never fullness.
 */
export type TargetTone = 'attention' | 'done' | 'plain';
```

and the fill:

```ts
  const fill =
    tone === 'attention'
      ? theme.palette.accent
      : tone === 'done'
        ? theme.palette.positive
        : theme.palette.barGrey;
```

- [ ] **Step 2: Bar**

In `ProgressBar.tsx`, add to the props after `thick?: boolean;`:

```ts
  /** A goal reached (§5.13): the fill turns `positive`. */
  done?: boolean;
```

add `done = false,` to the destructured props, and replace the fill colour
`backgroundColor: overPace ? theme.palette.accent : theme.palette.barGrey,` with:

```ts
            backgroundColor: done
              ? theme.palette.positive
              : overPace
                ? theme.palette.accent
                : theme.palette.barGrey,
```

- [ ] **Step 3: Featured block**

In `FeaturedTarget.tsx`: make `onPress` optional (`onPress?: () => void;`), pass `done={props.tone === 'done'}` to `ProgressBar`, and render a `View` instead of the `Pressable` when there is nothing to press. Replace the opening `<Pressable …>` and its closing tag with:

```tsx
  const body = (
    <>
      {/* …the existing children, unchanged… */}
    </>
  );
  const padding = { paddingTop: 14, paddingBottom: 16 };
  if (props.onPress === undefined) {
    return (
      <View accessible accessibilityLabel={props.accessibilityLabel} style={padding}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, ...padding })}
    >
      {body}
    </Pressable>
  );
```

(Move the existing children — the head row through the sentence — into `body`.)

- [ ] **Step 4: Check**

Run: `rtk proxy pnpm --filter mobile test -- src/components src/features/budgets src/features/targets` and `rtk proxy pnpm typecheck`
Expected: pass (budgets never use `done`).

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/components/TargetRing.tsx apps/mobile/src/components/ProgressBar.tsx apps/mobile/src/features/targets/FeaturedTarget.tsx
rtk git commit -m "feat(mobile): a done tone for reached goals"
```

---

### Task 2: `goals` strings

**Files:**
- Modify: `packages/i18n/src/locales/{it,en,fr,de,sv,es,pt}.ts`

Replace each catalog's `goals: { closeFirst: … },` block (Plan B1) with the block below. `<b>` is rendered at weight 500 through `Trans`.

- [ ] **Step 1: Italian**

```ts
  goals: {
    closeFirst: 'Chiudi prima gli obiettivi in questo conto',
    title: 'Obiettivi',
    empty: 'Nessun obiettivo',
    emptyBody: 'Un obiettivo mette da parte soldi in uno dei tuoi conti, verso una cifra e, se vuoi, una data.',
    create: 'Crea un obiettivo',
    all: 'Tutti gli obiettivi',
    newGoal: 'Nuovo obiettivo',
    editGoal: 'Modifica obiettivo',
    expired_one: '{{count}} scaduto',
    expired_other: '{{count}} scaduti',
    behind_one: '{{count}} indietro',
    behind_other: '{{count}} indietro',
    reached_one: '{{count}} raggiunto',
    reached_other: '{{count}} raggiunti',
    onTime: 'nei tempi',
    by: 'entro {{date}}',
    noDeadline: 'senza scadenza',
    expiredMeta: 'scaduto',
    expiredOnMeta: 'scaduto il {{date}}',
    toClose: 'da chiudere',
    reachedOnMeta: 'raggiunto il {{date}} · da chiudere',
    statusBehind: '{{amount}} indietro',
    statusAhead: '{{amount}} avanti',
    statusExpired: 'scaduto',
    statusReached: 'Raggiunto',
    statusMissing: 'mancano {{amount}}',
    perPeriod_month: 'Metti da parte <b>{{amount}} al mese</b> per arrivarci.',
    perPeriod_week: 'Metti da parte <b>{{amount}} a settimana</b> per arrivarci.',
    perPeriod_cycle: 'Metti da parte <b>{{amount}} a ciclo</b> per arrivarci.',
    perPeriod_year: "Metti da parte <b>{{amount}} all'anno</b> per arrivarci.",
    stateBehind: 'Sei {{amount}} indietro.',
    stateAhead: 'Sei {{amount}} avanti.',
    lastPeriod_one: 'Mancano <b>{{amount}} in {{count}} giorno</b>.',
    lastPeriod_other: 'Mancano <b>{{amount}} in {{count}} giorni</b>.',
    missingSentence: 'Mancano <b>{{amount}}</b>.',
    expiredSentence: 'Scaduto il {{date}}: mancano <b>{{amount}}</b>.',
    expiredState: 'Sposta la scadenza o chiudilo.',
    reachedSentence: 'Hai messo da parte <b>{{amount}}</b>.',
    reachedState: 'Chiudilo quando usi i soldi.',
    setAside: 'Accantona',
    withdraw: 'Preleva',
    parent: 'Conto',
    deadline: 'Scadenza',
    createdOn: 'Creato il',
    movements: 'Movimenti',
    noMovements: 'Ancora nessun movimento',
    close: 'Chiudi obiettivo',
    closeTitle: 'Hai usato i soldi?',
    closeBody: "Nell'obiettivo ci sono ancora {{amount}}.",
    recordExpense: 'Registra la spesa',
    returnTo: 'Riporta in {{name}}',
    closeEmpty: "L'obiettivo è vuoto: chiuderlo non sposta niente.",
    confirmClose: 'Chiudi',
    closed: 'Obiettivo chiuso',
    closedSection: 'Obiettivi chiusi',
    created: 'Obiettivo creato',
    saved: 'Obiettivo salvato',
    step_look: 'Come si chiama',
    step_target: 'Quanto vuoi mettere da parte',
    step_deadline: 'Entro quando',
    step_account: 'Dove li tieni',
    name: 'Nome',
    namePlaceholder: 'Macchina',
    target: 'Obiettivo',
    deadlineNone: 'Senza scadenza',
    deadlinePick: 'Scegli una data',
    alreadySaved: 'Già da parte',
    freeHint: 'Liberi in {{name}}: {{amount}}',
    missing_name: 'Dagli un nome',
    missing_target: 'Scrivi quanto vuoi mettere da parte',
    missing_deadline: 'Scegli una data dopo oggi',
    missing_parent: 'Scegli il conto',
    free: 'liberi',
    reachedTitle: 'Obiettivo {{name}} raggiunto: {{amount}}',
    itemLabel: '{{name}}, {{amount}} di {{target}}, {{status}}',
  },
```

- [ ] **Step 2: English**

```ts
  goals: {
    closeFirst: 'Close the goals in this account first',
    title: 'Goals',
    empty: 'No goals',
    emptyBody: 'A goal sets money aside inside one of your accounts, towards a figure and, if you like, a date.',
    create: 'Create a goal',
    all: 'All goals',
    newGoal: 'New goal',
    editGoal: 'Edit goal',
    expired_one: '{{count}} expired',
    expired_other: '{{count}} expired',
    behind_one: '{{count}} behind',
    behind_other: '{{count}} behind',
    reached_one: '{{count}} reached',
    reached_other: '{{count}} reached',
    onTime: 'on time',
    by: 'by {{date}}',
    noDeadline: 'no deadline',
    expiredMeta: 'expired',
    expiredOnMeta: 'expired {{date}}',
    toClose: 'to close',
    reachedOnMeta: 'reached {{date}} · to close',
    statusBehind: '{{amount}} behind',
    statusAhead: '{{amount}} ahead',
    statusExpired: 'expired',
    statusReached: 'Reached',
    statusMissing: '{{amount}} to go',
    perPeriod_month: 'Set aside <b>{{amount}} a month</b> to get there.',
    perPeriod_week: 'Set aside <b>{{amount}} a week</b> to get there.',
    perPeriod_cycle: 'Set aside <b>{{amount}} a cycle</b> to get there.',
    perPeriod_year: 'Set aside <b>{{amount}} a year</b> to get there.',
    stateBehind: "You're {{amount}} behind.",
    stateAhead: "You're {{amount}} ahead.",
    lastPeriod_one: '<b>{{amount}} to go in {{count}} day</b>.',
    lastPeriod_other: '<b>{{amount}} to go in {{count}} days</b>.',
    missingSentence: '<b>{{amount}}</b> to go.',
    expiredSentence: 'Expired on {{date}}: <b>{{amount}}</b> to go.',
    expiredState: 'Move the deadline or close it.',
    reachedSentence: "You've set aside <b>{{amount}}</b>.",
    reachedState: 'Close it when you use the money.',
    setAside: 'Set aside',
    withdraw: 'Withdraw',
    parent: 'Account',
    deadline: 'Deadline',
    createdOn: 'Created on',
    movements: 'Movements',
    noMovements: 'Nothing moved yet',
    close: 'Close goal',
    closeTitle: 'Did you use the money?',
    closeBody: '{{amount}} is still in the goal.',
    recordExpense: 'Record the expense',
    returnTo: 'Return it to {{name}}',
    closeEmpty: 'The goal is empty: closing it moves nothing.',
    confirmClose: 'Close',
    closed: 'Goal closed',
    closedSection: 'Closed goals',
    created: 'Goal created',
    saved: 'Goal saved',
    step_look: "What it's called",
    step_target: 'How much to set aside',
    step_deadline: 'By when',
    step_account: 'Where you keep it',
    name: 'Name',
    namePlaceholder: 'Car',
    target: 'Target',
    deadlineNone: 'No deadline',
    deadlinePick: 'Pick a date',
    alreadySaved: 'Already set aside',
    freeHint: 'Free in {{name}}: {{amount}}',
    missing_name: 'Give it a name',
    missing_target: 'Say how much to set aside',
    missing_deadline: 'Pick a date after today',
    missing_parent: 'Choose the account',
    free: 'free',
    reachedTitle: 'Goal {{name}} reached: {{amount}}',
    itemLabel: '{{name}}, {{amount}} of {{target}}, {{status}}',
  },
```

- [ ] **Step 3: French** (` ` = narrow no-break space before `:` and `?`, as the catalog's header asks)

```ts
  goals: {
    closeFirst: 'Ferme d’abord les objectifs de ce compte',
    title: 'Objectifs',
    empty: 'Aucun objectif',
    emptyBody: 'Un objectif met de l’argent de côté dans un de tes comptes, vers un montant et, si tu veux, une date.',
    create: 'Créer un objectif',
    all: 'Tous les objectifs',
    newGoal: 'Nouvel objectif',
    editGoal: 'Modifier l’objectif',
    expired_one: '{{count}} expiré',
    expired_other: '{{count}} expirés',
    behind_one: '{{count}} en retard',
    behind_other: '{{count}} en retard',
    reached_one: '{{count}} atteint',
    reached_other: '{{count}} atteints',
    onTime: 'dans les temps',
    by: 'd’ici le {{date}}',
    noDeadline: 'sans échéance',
    expiredMeta: 'expiré',
    expiredOnMeta: 'expiré le {{date}}',
    toClose: 'à fermer',
    reachedOnMeta: 'atteint le {{date}} · à fermer',
    statusBehind: '{{amount}} de retard',
    statusAhead: '{{amount}} d’avance',
    statusExpired: 'expiré',
    statusReached: 'Atteint',
    statusMissing: 'reste {{amount}}',
    perPeriod_month: 'Mets de côté <b>{{amount}} par mois</b> pour y arriver.',
    perPeriod_week: 'Mets de côté <b>{{amount}} par semaine</b> pour y arriver.',
    perPeriod_cycle: 'Mets de côté <b>{{amount}} par cycle</b> pour y arriver.',
    perPeriod_year: 'Mets de côté <b>{{amount}} par an</b> pour y arriver.',
    stateBehind: 'Tu as {{amount}} de retard.',
    stateAhead: 'Tu as {{amount}} d’avance.',
    lastPeriod_one: 'Il reste <b>{{amount}} en {{count}} jour</b>.',
    lastPeriod_other: 'Il reste <b>{{amount}} en {{count}} jours</b>.',
    missingSentence: 'Il reste <b>{{amount}}</b>.',
    expiredSentence: 'Expiré le {{date}} : il reste <b>{{amount}}</b>.',
    expiredState: 'Déplace l’échéance ou ferme-le.',
    reachedSentence: 'Tu as mis de côté <b>{{amount}}</b>.',
    reachedState: 'Ferme-le quand tu utilises l’argent.',
    setAside: 'Mettre de côté',
    withdraw: 'Retirer',
    parent: 'Compte',
    deadline: 'Échéance',
    createdOn: 'Créé le',
    movements: 'Mouvements',
    noMovements: 'Rien n’a encore bougé',
    close: 'Fermer l’objectif',
    closeTitle: 'As-tu utilisé l’argent ?',
    closeBody: '{{amount}} sont encore dans l’objectif.',
    recordExpense: 'Enregistrer la dépense',
    returnTo: 'Remettre sur {{name}}',
    closeEmpty: 'L’objectif est vide : le fermer ne déplace rien.',
    confirmClose: 'Fermer',
    closed: 'Objectif fermé',
    closedSection: 'Objectifs fermés',
    created: 'Objectif créé',
    saved: 'Objectif enregistré',
    step_look: 'Comment il s’appelle',
    step_target: 'Combien mettre de côté',
    step_deadline: 'D’ici quand',
    step_account: 'Où tu le gardes',
    name: 'Nom',
    namePlaceholder: 'Voiture',
    target: 'Objectif',
    deadlineNone: 'Sans échéance',
    deadlinePick: 'Choisir une date',
    alreadySaved: 'Déjà de côté',
    freeHint: 'Libre sur {{name}} : {{amount}}',
    missing_name: 'Donne-lui un nom',
    missing_target: 'Indique combien mettre de côté',
    missing_deadline: 'Choisis une date après aujourd’hui',
    missing_parent: 'Choisis le compte',
    free: 'libre',
    reachedTitle: 'Objectif {{name}} atteint : {{amount}}',
    itemLabel: '{{name}}, {{amount}} sur {{target}}, {{status}}',
  },
```

- [ ] **Step 4: German**

```ts
  goals: {
    closeFirst: 'Schließe zuerst die Ziele in diesem Konto',
    title: 'Ziele',
    empty: 'Keine Ziele',
    emptyBody: 'Ein Ziel legt Geld in einem deiner Konten zurück, auf einen Betrag hin und, wenn du willst, bis zu einem Datum.',
    create: 'Ziel erstellen',
    all: 'Alle Ziele',
    newGoal: 'Neues Ziel',
    editGoal: 'Ziel bearbeiten',
    expired_one: '{{count}} abgelaufen',
    expired_other: '{{count}} abgelaufen',
    behind_one: '{{count}} im Rückstand',
    behind_other: '{{count}} im Rückstand',
    reached_one: '{{count}} erreicht',
    reached_other: '{{count}} erreicht',
    onTime: 'im Plan',
    by: 'bis {{date}}',
    noDeadline: 'ohne Frist',
    expiredMeta: 'abgelaufen',
    expiredOnMeta: 'abgelaufen am {{date}}',
    toClose: 'zu schließen',
    reachedOnMeta: 'erreicht am {{date}} · zu schließen',
    statusBehind: '{{amount}} im Rückstand',
    statusAhead: '{{amount}} voraus',
    statusExpired: 'abgelaufen',
    statusReached: 'Erreicht',
    statusMissing: 'noch {{amount}}',
    perPeriod_month: 'Leg <b>{{amount}} pro Monat</b> zurück, um es zu schaffen.',
    perPeriod_week: 'Leg <b>{{amount}} pro Woche</b> zurück, um es zu schaffen.',
    perPeriod_cycle: 'Leg <b>{{amount}} pro Zyklus</b> zurück, um es zu schaffen.',
    perPeriod_year: 'Leg <b>{{amount}} pro Jahr</b> zurück, um es zu schaffen.',
    stateBehind: 'Du liegst {{amount}} zurück.',
    stateAhead: 'Du liegst {{amount}} vorn.',
    lastPeriod_one: 'Noch <b>{{amount}} in {{count}} Tag</b>.',
    lastPeriod_other: 'Noch <b>{{amount}} in {{count}} Tagen</b>.',
    missingSentence: 'Noch <b>{{amount}}</b>.',
    expiredSentence: 'Abgelaufen am {{date}}: noch <b>{{amount}}</b>.',
    expiredState: 'Verschieb die Frist oder schließ es.',
    reachedSentence: 'Du hast <b>{{amount}}</b> zurückgelegt.',
    reachedState: 'Schließ es, wenn du das Geld verwendest.',
    setAside: 'Zurücklegen',
    withdraw: 'Abheben',
    parent: 'Konto',
    deadline: 'Frist',
    createdOn: 'Erstellt am',
    movements: 'Bewegungen',
    noMovements: 'Noch keine Bewegungen',
    close: 'Ziel schließen',
    closeTitle: 'Hast du das Geld verwendet?',
    closeBody: '{{amount}} liegen noch im Ziel.',
    recordExpense: 'Ausgabe erfassen',
    returnTo: 'Zurück auf {{name}}',
    closeEmpty: 'Das Ziel ist leer: Schließen bewegt nichts.',
    confirmClose: 'Schließen',
    closed: 'Ziel geschlossen',
    closedSection: 'Geschlossene Ziele',
    created: 'Ziel erstellt',
    saved: 'Ziel gespeichert',
    step_look: 'Wie es heißt',
    step_target: 'Wie viel zurücklegen',
    step_deadline: 'Bis wann',
    step_account: 'Wo du es hast',
    name: 'Name',
    namePlaceholder: 'Auto',
    target: 'Ziel',
    deadlineNone: 'Ohne Frist',
    deadlinePick: 'Datum wählen',
    alreadySaved: 'Schon zurückgelegt',
    freeHint: 'Frei auf {{name}}: {{amount}}',
    missing_name: 'Gib ihm einen Namen',
    missing_target: 'Gib an, wie viel du zurücklegen willst',
    missing_deadline: 'Wähl ein Datum nach heute',
    missing_parent: 'Wähl das Konto',
    free: 'frei',
    reachedTitle: 'Ziel {{name}} erreicht: {{amount}}',
    itemLabel: '{{name}}, {{amount}} von {{target}}, {{status}}',
  },
```

- [ ] **Step 5: Swedish**

```ts
  goals: {
    closeFirst: 'Stäng först målen i det här kontot',
    title: 'Mål',
    empty: 'Inga mål',
    emptyBody: 'Ett mål lägger undan pengar i ett av dina konton, mot ett belopp och, om du vill, ett datum.',
    create: 'Skapa ett mål',
    all: 'Alla mål',
    newGoal: 'Nytt mål',
    editGoal: 'Redigera mål',
    expired_one: '{{count}} har gått ut',
    expired_other: '{{count}} har gått ut',
    behind_one: '{{count}} efter',
    behind_other: '{{count}} efter',
    reached_one: '{{count}} nått',
    reached_other: '{{count}} nådda',
    onTime: 'i tid',
    by: 'senast {{date}}',
    noDeadline: 'utan slutdatum',
    expiredMeta: 'har gått ut',
    expiredOnMeta: 'gick ut {{date}}',
    toClose: 'att stänga',
    reachedOnMeta: 'nått {{date}} · att stänga',
    statusBehind: '{{amount}} efter',
    statusAhead: '{{amount}} före',
    statusExpired: 'har gått ut',
    statusReached: 'Nått',
    statusMissing: '{{amount}} kvar',
    perPeriod_month: 'Lägg undan <b>{{amount}} i månaden</b> för att nå dit.',
    perPeriod_week: 'Lägg undan <b>{{amount}} i veckan</b> för att nå dit.',
    perPeriod_cycle: 'Lägg undan <b>{{amount}} per period</b> för att nå dit.',
    perPeriod_year: 'Lägg undan <b>{{amount}} om året</b> för att nå dit.',
    stateBehind: 'Du ligger {{amount}} efter.',
    stateAhead: 'Du ligger {{amount}} före.',
    lastPeriod_one: '<b>{{amount}} kvar på {{count}} dag</b>.',
    lastPeriod_other: '<b>{{amount}} kvar på {{count}} dagar</b>.',
    missingSentence: '<b>{{amount}}</b> kvar.',
    expiredSentence: 'Gick ut {{date}}: <b>{{amount}}</b> kvar.',
    expiredState: 'Flytta slutdatumet eller stäng det.',
    reachedSentence: 'Du har lagt undan <b>{{amount}}</b>.',
    reachedState: 'Stäng det när du använder pengarna.',
    setAside: 'Lägg undan',
    withdraw: 'Ta ut',
    parent: 'Konto',
    deadline: 'Slutdatum',
    createdOn: 'Skapat',
    movements: 'Rörelser',
    noMovements: 'Inget har rört sig än',
    close: 'Stäng målet',
    closeTitle: 'Har du använt pengarna?',
    closeBody: '{{amount}} finns kvar i målet.',
    recordExpense: 'Registrera utgiften',
    returnTo: 'Flytta tillbaka till {{name}}',
    closeEmpty: 'Målet är tomt: att stänga det flyttar ingenting.',
    confirmClose: 'Stäng',
    closed: 'Målet stängt',
    closedSection: 'Stängda mål',
    created: 'Målet skapat',
    saved: 'Målet sparat',
    step_look: 'Vad det heter',
    step_target: 'Hur mycket du lägger undan',
    step_deadline: 'Till när',
    step_account: 'Var du har det',
    name: 'Namn',
    namePlaceholder: 'Bil',
    target: 'Mål',
    deadlineNone: 'Utan slutdatum',
    deadlinePick: 'Välj ett datum',
    alreadySaved: 'Redan undanlagt',
    freeHint: 'Fritt på {{name}}: {{amount}}',
    missing_name: 'Ge det ett namn',
    missing_target: 'Ange hur mycket du lägger undan',
    missing_deadline: 'Välj ett datum efter i dag',
    missing_parent: 'Välj kontot',
    free: 'fritt',
    reachedTitle: 'Målet {{name}} nått: {{amount}}',
    itemLabel: '{{name}}, {{amount}} av {{target}}, {{status}}',
  },
```

- [ ] **Step 6: Spanish**

```ts
  goals: {
    closeFirst: 'Cierra primero los objetivos de esta cuenta',
    title: 'Objetivos',
    empty: 'Ningún objetivo',
    emptyBody: 'Un objetivo aparta dinero dentro de una de tus cuentas, hacia una cifra y, si quieres, una fecha.',
    create: 'Crear un objetivo',
    all: 'Todos los objetivos',
    newGoal: 'Nuevo objetivo',
    editGoal: 'Editar objetivo',
    expired_one: '{{count}} vencido',
    expired_other: '{{count}} vencidos',
    behind_one: '{{count}} con retraso',
    behind_other: '{{count}} con retraso',
    reached_one: '{{count}} alcanzado',
    reached_other: '{{count}} alcanzados',
    onTime: 'a tiempo',
    by: 'antes del {{date}}',
    noDeadline: 'sin fecha límite',
    expiredMeta: 'vencido',
    expiredOnMeta: 'venció el {{date}}',
    toClose: 'por cerrar',
    reachedOnMeta: 'alcanzado el {{date}} · por cerrar',
    statusBehind: '{{amount}} de retraso',
    statusAhead: '{{amount}} de ventaja',
    statusExpired: 'vencido',
    statusReached: 'Alcanzado',
    statusMissing: 'faltan {{amount}}',
    perPeriod_month: 'Aparta <b>{{amount}} al mes</b> para llegar.',
    perPeriod_week: 'Aparta <b>{{amount}} a la semana</b> para llegar.',
    perPeriod_cycle: 'Aparta <b>{{amount}} por ciclo</b> para llegar.',
    perPeriod_year: 'Aparta <b>{{amount}} al año</b> para llegar.',
    stateBehind: 'Vas {{amount}} por detrás.',
    stateAhead: 'Vas {{amount}} por delante.',
    lastPeriod_one: 'Faltan <b>{{amount}} en {{count}} día</b>.',
    lastPeriod_other: 'Faltan <b>{{amount}} en {{count}} días</b>.',
    missingSentence: 'Faltan <b>{{amount}}</b>.',
    expiredSentence: 'Venció el {{date}}: faltan <b>{{amount}}</b>.',
    expiredState: 'Mueve la fecha límite o ciérralo.',
    reachedSentence: 'Has apartado <b>{{amount}}</b>.',
    reachedState: 'Ciérralo cuando uses el dinero.',
    setAside: 'Apartar',
    withdraw: 'Retirar',
    parent: 'Cuenta',
    deadline: 'Fecha límite',
    createdOn: 'Creado el',
    movements: 'Movimientos',
    noMovements: 'Aún no se ha movido nada',
    close: 'Cerrar objetivo',
    closeTitle: '¿Has usado el dinero?',
    closeBody: 'Quedan {{amount}} en el objetivo.',
    recordExpense: 'Registrar el gasto',
    returnTo: 'Devolverlo a {{name}}',
    closeEmpty: 'El objetivo está vacío: cerrarlo no mueve nada.',
    confirmClose: 'Cerrar',
    closed: 'Objetivo cerrado',
    closedSection: 'Objetivos cerrados',
    created: 'Objetivo creado',
    saved: 'Objetivo guardado',
    step_look: 'Cómo se llama',
    step_target: 'Cuánto quieres apartar',
    step_deadline: 'Para cuándo',
    step_account: 'Dónde lo guardas',
    name: 'Nombre',
    namePlaceholder: 'Coche',
    target: 'Objetivo',
    deadlineNone: 'Sin fecha límite',
    deadlinePick: 'Elegir una fecha',
    alreadySaved: 'Ya apartado',
    freeHint: 'Libre en {{name}}: {{amount}}',
    missing_name: 'Ponle un nombre',
    missing_target: 'Indica cuánto quieres apartar',
    missing_deadline: 'Elige una fecha posterior a hoy',
    missing_parent: 'Elige la cuenta',
    free: 'libre',
    reachedTitle: 'Objetivo {{name}} alcanzado: {{amount}}',
    itemLabel: '{{name}}, {{amount}} de {{target}}, {{status}}',
  },
```

- [ ] **Step 7: Portuguese (European, "tu")**

```ts
  goals: {
    closeFirst: 'Fecha primeiro os objetivos desta conta',
    title: 'Objetivos',
    empty: 'Nenhum objetivo',
    emptyBody: 'Um objetivo põe dinheiro de parte numa das tuas contas, rumo a um valor e, se quiseres, a uma data.',
    create: 'Criar um objetivo',
    all: 'Todos os objetivos',
    newGoal: 'Novo objetivo',
    editGoal: 'Editar objetivo',
    expired_one: '{{count}} expirado',
    expired_other: '{{count}} expirados',
    behind_one: '{{count}} atrasado',
    behind_other: '{{count}} atrasados',
    reached_one: '{{count}} atingido',
    reached_other: '{{count}} atingidos',
    onTime: 'dentro do prazo',
    by: 'até {{date}}',
    noDeadline: 'sem prazo',
    expiredMeta: 'expirado',
    expiredOnMeta: 'expirou a {{date}}',
    toClose: 'por fechar',
    reachedOnMeta: 'atingido a {{date}} · por fechar',
    statusBehind: '{{amount}} atrasado',
    statusAhead: '{{amount}} adiantado',
    statusExpired: 'expirado',
    statusReached: 'Atingido',
    statusMissing: 'faltam {{amount}}',
    perPeriod_month: 'Põe de parte <b>{{amount}} por mês</b> para lá chegares.',
    perPeriod_week: 'Põe de parte <b>{{amount}} por semana</b> para lá chegares.',
    perPeriod_cycle: 'Põe de parte <b>{{amount}} por ciclo</b> para lá chegares.',
    perPeriod_year: 'Põe de parte <b>{{amount}} por ano</b> para lá chegares.',
    stateBehind: 'Estás {{amount}} atrasado.',
    stateAhead: 'Estás {{amount}} adiantado.',
    lastPeriod_one: 'Faltam <b>{{amount}} em {{count}} dia</b>.',
    lastPeriod_other: 'Faltam <b>{{amount}} em {{count}} dias</b>.',
    missingSentence: 'Faltam <b>{{amount}}</b>.',
    expiredSentence: 'Expirou a {{date}}: faltam <b>{{amount}}</b>.',
    expiredState: 'Muda o prazo ou fecha-o.',
    reachedSentence: 'Puseste de parte <b>{{amount}}</b>.',
    reachedState: 'Fecha-o quando usares o dinheiro.',
    setAside: 'Pôr de parte',
    withdraw: 'Levantar',
    parent: 'Conta',
    deadline: 'Prazo',
    createdOn: 'Criado a',
    movements: 'Movimentos',
    noMovements: 'Ainda nada se mexeu',
    close: 'Fechar objetivo',
    closeTitle: 'Usaste o dinheiro?',
    closeBody: 'Ainda há {{amount}} no objetivo.',
    recordExpense: 'Registar a despesa',
    returnTo: 'Devolver a {{name}}',
    closeEmpty: 'O objetivo está vazio: fechá-lo não mexe em nada.',
    confirmClose: 'Fechar',
    closed: 'Objetivo fechado',
    closedSection: 'Objetivos fechados',
    created: 'Objetivo criado',
    saved: 'Objetivo guardado',
    step_look: 'Como se chama',
    step_target: 'Quanto queres pôr de parte',
    step_deadline: 'Até quando',
    step_account: 'Onde o guardas',
    name: 'Nome',
    namePlaceholder: 'Carro',
    target: 'Objetivo',
    deadlineNone: 'Sem prazo',
    deadlinePick: 'Escolher uma data',
    alreadySaved: 'Já posto de parte',
    freeHint: 'Livre em {{name}}: {{amount}}',
    missing_name: 'Dá-lhe um nome',
    missing_target: 'Indica quanto queres pôr de parte',
    missing_deadline: 'Escolhe uma data depois de hoje',
    missing_parent: 'Escolhe a conta',
    free: 'livre',
    reachedTitle: 'Objetivo {{name}} atingido: {{amount}}',
    itemLabel: '{{name}}, {{amount}} de {{target}}, {{status}}',
  },
```

- [ ] **Step 8: Check and commit**

Run: `rtk proxy pnpm --filter @saldo/i18n test`, then check each catalog's `goals.title` differs from Italian except where the word is the same (`es`/`pt` «Objetivos») — the parity test cannot catch a copied block.

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): goal strings"
```

---

### Task 3: `goalViews`, `useGoalViews`, `useGoalText`

**Files:**
- Create: `apps/mobile/src/features/goals/goalViews.ts`, `goalViews.test.ts`, `useGoalViews.ts`, `useGoalText.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/goals/goalViews.test.ts`:

```ts
import type { Account, Transaction } from '@saldo/core';
import { goalViews } from './goalViews';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '1',
  deletedAt: null,
  institution: null,
  openingBalance: 0,
  colorIndex: 0,
  icon: 'car',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  sortOrder: 0,
};

const checking: Account = {
  ...meta,
  id: 'checking',
  name: 'Conto',
  type: 'checking',
  includeInSpendable: true,
  archivedAt: null,
};

const pocket = (id: string, archivedAt: string | null = null): Account => ({
  ...meta,
  id,
  name: id,
  type: 'pocket',
  includeInSpendable: false,
  archivedAt,
  parentAccountId: 'checking',
  goalTarget: 100_000,
  goalDeadline: null,
  goalStartDate: '2026-01-01',
});

const transfer: Transaction = {
  id: 't1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '1',
  deletedAt: null,
  kind: 'transfer',
  amount: 40_000,
  date: '2026-02-01',
  accountId: 'checking',
  toAccountId: 'car',
  categoryId: null,
  description: '',
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
};

describe('goalViews', () => {
  it('measures every open pocket and names its parent', () => {
    const views = goalViews(
      [checking, pocket('car'), pocket('sofa', '2026-05-01T00:00:00.000Z')],
      [transfer],
      '2026-09-24',
      { kind: 'month', startDay: 1 },
    );
    expect(views.map((view) => view.account.id)).toEqual(['car']);
    expect(views[0]?.parent?.name).toBe('Conto');
    expect(views[0]?.progress.saved).toBe(40_000);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals`
Expected: FAIL — `Cannot find module './goalViews'`.

- [ ] **Step 3: Implement the mapper**

Create `apps/mobile/src/features/goals/goalViews.ts`:

```ts
import {
  type Account,
  type GoalProgress,
  goalProgress,
  isPocket,
  type LedgerTx,
  type LocalDate,
  type PeriodDef,
} from '@saldo/core';

/** An open goal as every screen reads it (§5.14). */
export interface GoalView {
  account: Account;
  parent: Account | undefined;
  progress: GoalProgress;
}

/** Open pockets with their progress, in the accounts' order. Pure: `today` and `def` are injected. */
export function goalViews(
  accounts: readonly Account[],
  txs: readonly LedgerTx[],
  today: LocalDate,
  def: PeriodDef,
): GoalView[] {
  return accounts.flatMap((account) => {
    const { goalTarget, goalStartDate } = account;
    if (!isPocket(account) || account.archivedAt !== null) return [];
    if (goalTarget == null || goalStartDate == null) return [];
    return [
      {
        account,
        parent: accounts.find((candidate) => candidate.id === account.parentAccountId),
        progress: goalProgress(
          {
            id: account.id,
            openingBalance: account.openingBalance,
            goalTarget,
            goalDeadline: account.goalDeadline ?? null,
            goalStartDate,
          },
          txs,
          today,
          def,
        ),
      },
    ];
  });
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals`
Expected: PASS.

- [ ] **Step 5: The data hook**

Create `apps/mobile/src/features/goals/useGoalViews.ts`:

```ts
import { useMemo } from 'react';
import { useAccountsQuery, useTransactionsInRangeQuery } from '../../db/hooks';
import { usePeriod } from '../period/PeriodProvider';
import { goalViews } from './goalViews';

/**
 * Open goals with their progress. A goal's balance covers its whole history, so the range is
 * unbounded (§5.3), as on the Accounts tab.
 */
export function useGoalViews() {
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { today, def } = usePeriod();
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery('1970-01-01', today);
  const views = useMemo(() => goalViews(accounts, rows, today, def), [accounts, rows, today, def]);
  return { views, accounts, rows, loaded: accountsLoaded && rowsLoaded };
}
```

- [ ] **Step 6: The strings hook**

Create `apps/mobile/src/features/goals/useGoalText.tsx`:

```tsx
import { goalAdvice, type LocalDate, parseLocalDate } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoney, formatMonthYear } from '@saldo/i18n';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TargetTone } from '../../components/TargetRing';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { usePeriod } from '../period/PeriodProvider';
import type { GoalView } from './goalViews';

const BOLD = { b: <Text weight="medium" /> };

/** «15 ott» this year, «giugno 2027» after. */
export function deadlineLabel(date: LocalDate, today: LocalDate, locale: AppLocale): string {
  const { year, month } = parseLocalDate(date);
  return year === parseLocalDate(today).year
    ? formatDayMonth(date, locale)
    : formatMonthYear({ year, month }, locale);
}

/**
 * Every string a goal renders (§5.14), in one place: the Home card, the list and the detail read
 * the same status, meta and sentence.
 */
export function useGoalText() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const kind = settings?.periodKind ?? 'month';
  const money = (minor: number) => formatMoney(minor, currency, locale);

  const tone = (view: GoalView): TargetTone => {
    const { state } = view.progress;
    if (state === 'reached') return 'done';
    return state === 'expired' || state === 'behind' ? 'attention' : 'plain';
  };

  const status = (view: GoalView): string => {
    const { state, gap, missing } = view.progress;
    switch (state) {
      case 'reached':
        return t('goals.statusReached');
      case 'expired':
        return t('goals.statusExpired');
      case 'behind':
        return t('goals.statusBehind', { amount: money(-(gap ?? 0)) });
      case 'onTrack':
        return t('goals.statusAhead', { amount: money(gap ?? 0) });
      case 'open':
        return t('goals.statusMissing', { amount: money(missing) });
    }
  };

  /** Beside the name: short on the featured block, full on a row. */
  const meta = (view: GoalView, short = false): string => {
    const { state, reachedOn } = view.progress;
    const deadline = view.account.goalDeadline ?? null;
    if (state === 'reached') {
      return short || reachedOn === null
        ? t('goals.toClose')
        : t('goals.reachedOnMeta', { date: formatDayMonth(reachedOn, locale) });
    }
    if (state === 'expired' && deadline !== null) {
      return short
        ? t('goals.expiredMeta')
        : t('goals.expiredOnMeta', { date: formatDayMonth(deadline, locale) });
    }
    return deadline === null
      ? t('goals.noDeadline')
      : t('goals.by', { date: deadlineLabel(deadline, today, locale) });
  };

  /** The tick, «oggi» included; none once the goal is reached or expired. */
  const pace = (view: GoalView): number | null => {
    const { state, pace: value } = view.progress;
    return state === 'reached' || state === 'expired' ? null : value;
  };

  const ends = (view: GoalView) => {
    const start = view.account.goalStartDate ?? today;
    const deadline = view.account.goalDeadline ?? null;
    return {
      start: deadlineLabel(start, today, locale),
      end: deadline === null ? '' : deadlineLabel(deadline, today, locale),
    };
  };

  const of = (view: GoalView) =>
    t('targets.ofLimit', {
      amount: money(view.progress.target),
      percent: t('targets.percent', { value: Math.round(view.progress.ratio * 100) }),
    });

  const label = (view: GoalView) =>
    t('goals.itemLabel', {
      name: view.account.name,
      amount: money(view.progress.saved),
      target: money(view.progress.target),
      status: status(view),
    });

  const sentence = (view: GoalView): ReactNode => {
    const advice = goalAdvice(view.progress);
    switch (advice.kind) {
      case 'perPeriod':
        return (
          <>
            <Trans
              t={t}
              i18nKey={`goals.perPeriod_${kind}`}
              values={{ amount: money(advice.perPeriod) }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">
              {t(advice.behind ? 'goals.stateBehind' : 'goals.stateAhead', {
                amount: money(advice.gap),
              })}
            </Text>
          </>
        );
      case 'lastPeriod':
        return (
          <Trans
            t={t}
            i18nKey="goals.lastPeriod"
            count={advice.days}
            values={{ amount: money(advice.missing), count: advice.days }}
            components={BOLD}
          />
        );
      case 'noDeadline':
        return (
          <Trans
            t={t}
            i18nKey="goals.missingSentence"
            values={{ amount: money(advice.missing) }}
            components={BOLD}
          />
        );
      case 'expired':
        return (
          <>
            <Trans
              t={t}
              i18nKey="goals.expiredSentence"
              values={{
                amount: money(advice.missing),
                date: formatDayMonth(view.account.goalDeadline ?? today, locale),
              }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">{t('goals.expiredState')}</Text>
          </>
        );
      case 'reached':
        return (
          <>
            <Trans
              t={t}
              i18nKey="goals.reachedSentence"
              values={{ amount: money(advice.target) }}
              components={BOLD}
            />{' '}
            <Text color="textMuted">{t('goals.reachedState')}</Text>
          </>
        );
    }
  };

  return { t, locale, currency, money, tone, status, meta, pace, ends, of, label, sentence };
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `rtk proxy pnpm typecheck`
Expected: pass.

```bash
rtk git add apps/mobile/src/features/goals
rtk git commit -m "feat(mobile): goal views and the strings every goal screen shares"
```

---

### Task 4: The Obiettivi card on Home, and the reached notification

**Files:**
- Create: `apps/mobile/src/features/goals/HomeGoalsCard.tsx`, `HomeGoalsCard.test.tsx`, `goalAlerts.ts`, `goalAlerts.test.ts`, `GoalAlertsGate.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/features/goals/HomeGoalsCard.test.tsx`:

```tsx
import type { Account, GoalProgress } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { GoalView } from './goalViews';
import { FEATURED_GOAL_KEY, HomeGoalsCard } from './HomeGoalsCard';

const mockPush = jest.fn();
const mockKv = new Map<string, string>();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR', periodKind: 'month' }),
}));
jest.mock('../period/PeriodProvider', () => ({
  usePeriod: () => ({ today: '2026-09-24', def: { kind: 'month', startDay: 1 } }),
}));
jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => mockKv.get(key) ?? null,
      set: (key: string, value: string) => {
        mockKv.set(key, value);
      },
    },
  }),
}));

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});
beforeEach(() => {
  mockPush.mockClear();
  mockKv.clear();
});

function view(
  id: string,
  name: string,
  progress: Partial<GoalProgress>,
  goalDeadline: string | null = '2027-06-30',
): GoalView {
  const account: Account = {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    type: 'pocket',
    institution: null,
    openingBalance: 0,
    includeInSpendable: false,
    colorIndex: 5,
    icon: 'car',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    parentAccountId: 'checking',
    goalTarget: progress.target ?? 1_200_000,
    goalDeadline,
    goalStartDate: '2026-01-01',
  };
  return {
    account,
    parent: undefined,
    progress: {
      saved: 0,
      target: 1_200_000,
      ratio: 0,
      missing: 1_200_000,
      state: 'onTrack',
      reachedOn: null,
      pace: 0.5,
      gap: 0,
      periodsLeft: 9,
      perPeriod: 0,
      daysLeft: 279,
      ...progress,
    },
  };
}

function card(views: readonly GoalView[]) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HomeGoalsCard views={views} />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('HomeGoalsCard', () => {
  it('features the goal furthest behind and says what to set aside each month', async () => {
    await render(
      card([
        view('car', 'Car', {
          saved: 542_000,
          ratio: 0.45,
          missing: 658_000,
          state: 'behind',
          gap: -43_600,
          perPeriod: 73_100,
        }),
        view('trip', 'Japan', { saved: 298_000, target: 350_000, ratio: 0.85, gap: 121_250 }),
      ]),
    );
    expect(screen.getByText('1 behind')).toBeTruthy();
    expect(
      screen.getByText("Set aside €731.00 a month to get there. You're €436.00 behind."),
    ).toBeTruthy();
    expect(screen.queryByText('Japan')).toBeNull();
  });

  it('features an expired goal and gives a reached one its own row', async () => {
    await render(
      card([
        view('gift', 'Gift', { state: 'expired', missing: 11_000, target: 40_000 }, '2026-09-15'),
        view('sofa', 'Sofa', {
          state: 'reached',
          saved: 120_000,
          target: 120_000,
          ratio: 1,
          missing: 0,
          reachedOn: '2026-09-20',
        }),
      ]),
    );
    expect(screen.getByText('1 expired · 1 reached')).toBeTruthy();
    expect(screen.getByLabelText(/^Gift, /)).toBeTruthy();
    expect(screen.getByText('Sofa')).toBeTruthy();
    expect(screen.getByText('Reached')).toBeTruthy();
  });

  it('features the latest reached goal when every goal is reached', async () => {
    await render(
      card([
        view('sofa', 'Sofa', {
          state: 'reached',
          saved: 120_000,
          target: 120_000,
          ratio: 1,
          missing: 0,
          reachedOn: '2026-09-20',
        }),
      ]),
    );
    expect(
      screen.getByText("You've set aside €1,200.00. Close it when you use the money."),
    ).toBeTruthy();
  });

  it('opens the goal, the list, and remembers what it featured', async () => {
    await render(card([view('car', 'Car', { state: 'behind', gap: -1, perPeriod: 1 })]));
    await userEvent.press(screen.getByLabelText(/^Car, /));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/goal/[id]', params: { id: 'car' } });
    await userEvent.press(screen.getByLabelText('All goals, 1'));
    expect(mockPush).toHaveBeenCalledWith('/goals');
    expect(mockKv.get(FEATURED_GOAL_KEY)).toBe('car');
  });

  it('stays on Home without goals and leads to the wizard', async () => {
    await render(card([]));
    expect(screen.getByText('No goals')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Create a goal'));
    expect(mockPush).toHaveBeenCalledWith('/goal/new');
  });
});
```

Create `apps/mobile/src/features/goals/goalAlerts.test.ts`:

```ts
import type { GoalView } from './goalViews';
import { goalAlertKey, pendingGoalAlerts } from './goalAlerts';

const view = (id: string, state: GoalView['progress']['state']) =>
  ({ account: { id, name: id }, progress: { state, target: 1000 } }) as unknown as GoalView;

describe('pendingGoalAlerts', () => {
  it('notifies a reached goal once, ever', () => {
    const store = new Map<string, string>([[goalAlertKey('old'), '2026-09-01']]);
    const pending = pendingGoalAlerts(
      [view('new', 'reached'), view('old', 'reached'), view('car', 'behind')],
      { get: (key: string) => store.get(key) ?? null },
    );
    expect(pending.map((goal) => goal.account.id)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals`
Expected: FAIL — `./HomeGoalsCard` and `./goalAlerts` missing.

- [ ] **Step 3: The card**

Create `apps/mobile/src/features/goals/HomeGoalsCard.tsx`:

```tsx
import {
  featuredTarget,
  type GoalTargetInput,
  goalCardStatus,
  goalEventIds,
  rankGoal,
} from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { ListRow } from '../../components/ListRow';
import { TargetRing } from '../../components/TargetRing';
import { useDatabase } from '../../db/DatabaseProvider';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { FeaturedTarget } from '../targets/FeaturedTarget';
import { SeeAllRow } from '../targets/SeeAllRow';
import type { GoalView } from './goalViews';
import { useGoalText } from './useGoalText';

/** Device-local (never synced): the goal featured last, for the hysteresis of §5.13. */
export const FEATURED_GOAL_KEY = 'home.featuredGoal';

/** §5.13 for goals: always reads today, whatever period Home shows. */
export function HomeGoalsCard({ views }: { views: readonly GoalView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { kv } = useDatabase();
  const text = useGoalText();
  const { t } = text;

  const inputs = useMemo<GoalTargetInput[]>(
    () => views.map((view) => ({ id: view.account.id, progress: view.progress })),
    [views],
  );
  const [previous, setPrevious] = useState(() => kv.get(FEATURED_GOAL_KEY));
  const featuredId = useMemo(
    () => featuredTarget(inputs.map(rankGoal), previous),
    [inputs, previous],
  );
  useEffect(() => {
    if (featuredId === null || featuredId === previous) return;
    kv.set(FEATURED_GOAL_KEY, featuredId);
    setPrevious(featuredId);
  }, [featuredId, previous, kv]);

  if (views.length === 0) {
    return (
      <Card>
        <CardHeader title={t('goals.title')} status={t('goals.empty')} />
        <SeeAllRow label={t('goals.create')} onPress={() => router.push('/goal/new')} />
      </Card>
    );
  }

  const openGoal = (id: string) => router.push({ pathname: '/goal/[id]', params: { id } });
  const colourOf = (view: GoalView) => theme.categoryColor(view.account.colorIndex);
  const percentOf = (view: GoalView) =>
    t('targets.percent', { value: Math.round(view.progress.ratio * 100) });
  const toneColour = (view: GoalView) => {
    const tone = text.tone(view);
    return tone === 'attention' ? 'accent' : tone === 'done' ? 'positive' : 'textMuted';
  };

  const status = goalCardStatus(inputs);
  const parts = [
    status.expired > 0 ? t('goals.expired', { count: status.expired }) : null,
    status.behind > 0 ? t('goals.behind', { count: status.behind }) : null,
    status.reached > 0 ? t('goals.reached', { count: status.reached }) : null,
  ].filter((part): part is string => part !== null);
  const statusText = parts.length === 0 ? t('goals.onTime') : parts.slice(0, 2).join(' · ');

  const featured = views.find((view) => view.account.id === featuredId);
  const eventIds = goalEventIds(inputs, featuredId);
  const events = eventIds.flatMap((id) => views.filter((view) => view.account.id === id));
  const rest = views.filter(
    (view) => view.account.id !== featuredId && !eventIds.includes(view.account.id),
  );

  return (
    <Card>
      <CardHeader
        title={t('goals.title')}
        status={statusText}
        statusTone={status.expired + status.behind > 0 ? 'accent' : 'muted'}
      />

      {featured === undefined ? null : (
        <FeaturedTarget
          icon={featured.account.icon as IconName}
          colour={colourOf(featured)}
          name={featured.account.name}
          meta={text.meta(featured, true)}
          amount={featured.progress.saved}
          currency={text.currency}
          locale={text.locale}
          of={text.of(featured)}
          ratio={featured.progress.ratio}
          pace={text.pace(featured)}
          tone={text.tone(featured)}
          start={text.ends(featured).start}
          end={text.ends(featured).end}
          sentence={text.sentence(featured)}
          accessibilityLabel={text.label(featured)}
          onPress={() => openGoal(featured.account.id)}
        />
      )}

      {events.length === 0 ? null : (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.palette.border, paddingTop: 4 }}>
          {events.map((view) => (
            <ListRow
              key={view.account.id}
              title={view.account.name}
              subtitle={text.meta(view)}
              leading={
                <TargetRing
                  size={theme.layout.targetRing}
                  ratio={view.progress.ratio}
                  pace={text.pace(view)}
                  tone={text.tone(view)}
                  icon={view.account.icon as IconName}
                  colour={colourOf(view)}
                />
              }
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text tabular>{percentOf(view)}</Text>
                  <Text size="footnote" color={toneColour(view)} tabular>
                    {text.status(view)}
                  </Text>
                </View>
              }
              onPress={() => openGoal(view.account.id)}
            />
          ))}
        </View>
      )}

      <SeeAllRow
        label={t('goals.all')}
        count={views.length}
        rings={rest.map((view) => ({
          id: view.account.id,
          ratio: view.progress.ratio,
          pace: text.pace(view),
          tone: text.tone(view),
          icon: view.account.icon as IconName,
          colour: colourOf(view),
        }))}
        onPress={() => router.push('/goals')}
      />
    </Card>
  );
}
```

- [ ] **Step 4: The notification**

Create `apps/mobile/src/features/goals/goalAlerts.ts`:

```ts
import type { KvStore } from '../../db/kv';
import type { GoalView } from './goalViews';

/** kv key set once a goal's «raggiunto» notification has been sent (§5.14). */
export function goalAlertKey(goalId: string): string {
  return `goalReached:${goalId}`;
}

/** Reached goals not yet notified on this device. Pure: reads the store, never writes it. */
export function pendingGoalAlerts(
  views: readonly GoalView[],
  store: Pick<KvStore, 'get'>,
): GoalView[] {
  return views.filter(
    (view) => view.progress.state === 'reached' && store.get(goalAlertKey(view.account.id)) === null,
  );
}
```

Create `apps/mobile/src/features/goals/GoalAlertsGate.tsx`:

```tsx
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { usePeriod } from '../period/PeriodProvider';
import { goalAlertKey, pendingGoalAlerts } from './goalAlerts';
import type { GoalView } from './goalViews';

/**
 * «Obiettivo {name} raggiunto» (§5.14), once per goal, with the permission flow of the budget
 * alerts. The amount follows hidden mode: a lock-screen banner is what hiding is for.
 */
export function GoalAlertsGate({ views }: { views: readonly GoalView[] }) {
  const { t } = useTranslation();
  const { kv } = useDatabase();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  useEffect(() => {
    const pending = pendingGoalAlerts(views, kv);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;
      for (const view of pending) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('goals.reachedTitle', {
              name: view.account.name,
              amount: money(view.progress.target, currency, locale),
            }),
          },
          trigger: null,
        });
        kv.set(goalAlertKey(view.account.id), today);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [views, kv, t, money, currency, locale, today]);

  return null;
}
```

- [ ] **Step 5: Home**

In `app/(tabs)/index.tsx`:
- import `HomeGoalsCard`, `GoalAlertsGate` and `useGoalViews` from `../../src/features/goals/…`;
- after `const { rows: budgets, loaded: budgetsLoaded } = useBudgetsQuery();` add `const goals = useGoalViews();`;
- change `const loaded = rowsLoaded && budgetsLoaded;` to `const loaded = rowsLoaded && budgetsLoaded && goals.loaded;`;
- after the Budget card's `</Animated.View>`:

```tsx
          <Animated.View entering={entering(3)}>
            <HomeGoalsCard views={goals.views} />
          </Animated.View>
```

- change the recent card's `entering(3)` to `entering(4)`;
- next to `<BudgetAlertsGate views={views} />`: `{loaded ? <GoalAlertsGate views={goals.views} /> : null}`.

- [ ] **Step 6: Run and see them pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals` then `rtk proxy pnpm typecheck`
Expected: PASS. If a sentence test fails on text, `screen.debug()` it: `formatMoney(73_100, 'EUR', 'en')` is `€731.00`.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/mobile/src/features/goals "apps/mobile/app/(tabs)/index.tsx"
rtk git commit -m "feat(mobile): the Obiettivi target card on Home, and the reached notification"
```

---

### Task 5: Transfer and closing-expense links

**Files:**
- Create: `apps/mobile/src/features/goals/goalLinks.ts`, `goalLinks.test.ts`
- Modify: `apps/mobile/app/transaction/new.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/goals/goalLinks.test.ts`:

```ts
import { settlementForm } from '../accounts/settlement';
import { goalExpenseForm, goalExpenseParams, goalTransferParams } from './goalLinks';

describe('goal links', () => {
  it('opens a transfer from the parent into the goal, amount left to the user', () => {
    const form = settlementForm(goalTransferParams('checking', 'car', 'Macchina'), '2026-09-24', 2);
    expect(form?.values).toMatchObject({
      kind: 'transfer',
      accountId: 'checking',
      toAccountId: 'car',
      buffer: '',
      description: 'Macchina',
      date: '2026-09-24',
    });
    expect(form?.shortcuts).toEqual([]);
  });

  it('opens the closing expense from the goal, for its whole balance', () => {
    const form = goalExpenseForm(goalExpenseParams('car', 1_200_000, 'Macchina'), '2026-09-24', 2);
    expect(form?.closeGoalId).toBe('car');
    expect(form?.values).toMatchObject({
      kind: 'expense',
      accountId: 'car',
      buffer: '12000',
      description: 'Macchina',
      categoryId: null,
    });
  });

  it('is no closing expense without its goal', () => {
    expect(goalExpenseForm({}, '2026-09-24', 2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/goalLinks.test.ts`
Expected: FAIL — `./goalLinks` missing.

- [ ] **Step 3: Implement**

Create `apps/mobile/src/features/goals/goalLinks.ts`:

```ts
import { type LocalDate, type MinorDigits, minorToAmountBuffer } from '@saldo/core';
import { emptyForm, type TransactionFormValues } from '../transactions/useTransactionForm';

/**
 * «Accantona» / «Preleva» (§5.14): the ordinary transfer sheet, filled like «Salda carta»
 * (`settlementForm` reads these keys), with the amount left to the user.
 */
export function goalTransferParams(
  fromAccountId: string,
  toAccountId: string,
  description: string,
): Record<string, string> {
  return { settleTo: toAccountId, from: fromAccountId, description };
}

/** «Registra la spesa»: an expense from the goal for its whole balance; saving it closes the goal. */
export function goalExpenseParams(
  goalId: string,
  amount: number,
  description: string,
): Record<string, string> {
  return { closeGoal: goalId, amount: String(amount), description };
}

export function goalExpenseForm(
  params: Partial<Record<string, string | string[]>>,
  today: LocalDate,
  minorDigits: MinorDigits,
): { values: TransactionFormValues; closeGoalId: string } | null {
  const read = (key: string) => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };
  const goalId = read('closeGoal');
  if (goalId === undefined || goalId.length === 0) return null;
  const amount = Number(read('amount'));
  return {
    closeGoalId: goalId,
    values: {
      ...emptyForm(today, goalId),
      kind: 'expense',
      buffer:
        Number.isInteger(amount) && amount > 0 ? minorToAmountBuffer(amount, minorDigits) : '',
      description: read('description') ?? '',
    },
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/goalLinks.test.ts`
Expected: PASS. If `minorToAmountBuffer(1_200_000, 2)` is `'12000'` rather than `'12000.00'`, keep the function and change the expectation to what `@saldo/core` documents.

- [ ] **Step 5: The sheet closes the goal when the expense is saved**

In `app/transaction/new.tsx`:
- import `closeGoal` from `../../src/db/goalService` and `goalExpenseForm` from `../../src/features/goals/goalLinks`;
- after `const [settlement] = useState(…)` add:

```tsx
  // «Registra la spesa» (§5.14): saving this expense closes the goal; leaving does not.
  const [closing] = useState(() => goalExpenseForm(params, today, minorDigits));
```

- change the initial values to `() => settlement?.values ?? closing?.values ?? emptyForm(today, accounts[0]?.id ?? null)`;
- in `onSubmit`, after the recurrence block and before the toast:

```tsx
          if (closing !== null) {
            closeGoal(db, repos, closing.closeGoalId, today, new Date().toISOString());
            toast.show(t('goals.closed'));
            router.back();
            return;
          }
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/mobile/src/features/goals/goalLinks.ts apps/mobile/src/features/goals/goalLinks.test.ts apps/mobile/app/transaction/new.tsx
rtk git commit -m "feat(mobile): goal transfers and the closing expense open the transaction sheet"
```

---

### Task 6: The wizard

**Files:**
- Create: `apps/mobile/src/features/goals/goalFormValues.ts`, `steps.ts`, `steps.test.ts`, `GoalForm.tsx`
- Create: `apps/mobile/app/goal/new.tsx`, `apps/mobile/app/goal/edit/[id].tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/goals/steps.test.ts`:

```ts
import { emptyGoalForm } from './goalFormValues';
import { goalStepMissing } from './steps';

const TODAY = '2026-09-24';
const filled = {
  ...emptyGoalForm(),
  name: 'Macchina',
  buffer: '12000',
  deadline: '2027-06-30',
  parentAccountId: 'checking',
};

describe('goalStepMissing', () => {
  it('asks each step for its own answer', () => {
    expect(goalStepMissing('look', emptyGoalForm(), TODAY, 2)).toBe('name');
    expect(goalStepMissing('target', { ...filled, buffer: '' }, TODAY, 2)).toBe('target');
    expect(goalStepMissing('deadline', { ...filled, deadline: '2026-09-01' }, TODAY, 2)).toBe(
      'deadline',
    );
    expect(goalStepMissing('account', { ...filled, parentAccountId: null }, TODAY, 2)).toBe(
      'parent',
    );
  });

  it('lets a goal have no deadline', () => {
    expect(goalStepMissing('deadline', { ...filled, deadline: null }, TODAY, 2)).toBeNull();
  });

  it('checks everything again on the last step and on edit, in the wizard’s order', () => {
    expect(goalStepMissing('account', { ...filled, name: '' }, TODAY, 2)).toBe('name');
    expect(goalStepMissing('edit', { ...filled, parentAccountId: null }, TODAY, 2)).toBeNull();
    expect(goalStepMissing('edit', { ...filled, buffer: '0' }, TODAY, 2)).toBe('target');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/steps.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Values and steps**

Create `apps/mobile/src/features/goals/goalFormValues.ts`:

```ts
import type { Account, LocalDate, MinorDigits } from '@saldo/core';
import { minorToAmountBuffer } from '@saldo/core';
import type { IconName } from '@saldo/ui';

export interface GoalFormValues {
  name: string;
  icon: IconName;
  colorIndex: number;
  /** The target, as typed on the keypad. */
  buffer: string;
  deadline: LocalDate | null;
  parentAccountId: string | null;
  /** «Già da parte», moved from the parent on creation. */
  savedBuffer: string;
}

export function emptyGoalForm(): GoalFormValues {
  return {
    name: '',
    icon: 'target',
    colorIndex: 5,
    buffer: '',
    deadline: null,
    parentAccountId: null,
    savedBuffer: '',
  };
}

export function goalFormFrom(account: Account, minorDigits: MinorDigits): GoalFormValues {
  return {
    name: account.name,
    icon: account.icon as IconName,
    colorIndex: account.colorIndex,
    buffer: minorToAmountBuffer(account.goalTarget ?? 0, minorDigits),
    deadline: account.goalDeadline ?? null,
    parentAccountId: account.parentAccountId ?? null,
    savedBuffer: '',
  };
}
```

Create `apps/mobile/src/features/goals/steps.ts`:

```ts
import { amountBufferToMinor, type LocalDate, type MinorDigits } from '@saldo/core';
import type { GoalFormValues } from './goalFormValues';

/** §6.37: four steps for a new goal; an edit is one page without the account. */
export const GOAL_STEPS = ['look', 'target', 'deadline', 'account'] as const;
export type GoalStep = (typeof GOAL_STEPS)[number];

export type GoalMissing = 'name' | 'target' | 'deadline' | 'parent';

/**
 * What the step (or the edit page) is waiting for, in the wizard's own order, so the last step
 * names the earliest gap rather than the last one checked.
 */
export function goalStepMissing(
  step: GoalStep | 'edit',
  values: GoalFormValues,
  today: LocalDate,
  minorDigits: MinorDigits,
): GoalMissing | null {
  const checks: [GoalStep, GoalMissing, boolean][] = [
    ['look', 'name', values.name.trim().length > 0],
    ['target', 'target', amountBufferToMinor(values.buffer, minorDigits) > 0],
    ['deadline', 'deadline', values.deadline === null || values.deadline > today],
    ['account', 'parent', values.parentAccountId !== null],
  ];
  const upTo = step === 'edit' ? 2 : GOAL_STEPS.indexOf(step);
  for (const [, missing, ok] of checks.slice(0, upTo + 1)) {
    if (!ok) return missing;
  }
  return null;
}
```

(Step `edit` checks name, target and deadline; the parent never changes on edit, §5.14.)

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/steps.test.ts`
Expected: PASS.

- [ ] **Step 5: The form**

Create `apps/mobile/src/features/goals/GoalForm.tsx`:

```tsx
import {
  accountBalances,
  getCurrency,
  pocketParentCandidates,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { categoryIconGroups } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { AppearanceSheet } from '../../components/AppearanceSheet';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { DateSheet } from '../../components/DateSheet';
import { IconBox, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Stepper } from '../../components/Stepper';
import { TextField } from '../../components/TextField';
import { useAccounts, useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { usePeriod } from '../period/PeriodProvider';
import type { GoalFormValues } from './goalFormValues';
import { GOAL_STEPS, goalStepMissing } from './steps';
import { deadlineLabel } from './useGoalText';

export interface GoalFormProps {
  values: GoalFormValues;
  onChange: (values: GoalFormValues) => void;
  mode: 'new' | 'edit';
  onSubmit: () => void;
}

/** §6.37: a four-step wizard for a new goal, one page to edit one. */
export function GoalForm({ values, onChange, mode, onSubmit }: GoalFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);
  const [stepIndex, setStepIndex] = useState(0);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const rows = useTransactionsInRange('1970-01-01', today);
  const parents = pocketParentCandidates(accounts);
  const balances = useMemo(() => accountBalances(accounts, rows, today), [accounts, rows, today]);
  const set = (patch: Partial<GoalFormValues>) => onChange({ ...values, ...patch });

  const step = GOAL_STEPS[stepIndex] ?? 'account';
  const missing = goalStepMissing(mode === 'edit' ? 'edit' : step, values, today, minorDigits);
  const parent = parents.find((account) => account.id === values.parentAccountId);

  const look = () => (
    <Card>
      <View style={{ gap: 14 }}>
        <TextField
          label={t('goals.name')}
          placeholder={t('goals.namePlaceholder')}
          value={values.name}
          onChangeText={(name) => set({ name })}
          autoFocus={mode === 'new'}
        />
        <ListRow
          title={t('common.appearance')}
          leading={<IconBox name={values.icon} colour={theme.categoryColor(values.colorIndex)} />}
          onPress={() => setAppearanceOpen(true)}
          chevron
        />
      </View>
    </Card>
  );

  const target = () => (
    <Card>
      <Text size="footnote" color="textMuted">
        {t('goals.target')}
      </Text>
      <View style={{ marginTop: 6 }}>
        <AmountInput
          buffer={values.buffer}
          onChange={(buffer) => set({ buffer })}
          currency={currency}
          locale={locale}
          autoFocus={mode === 'new'}
          label={t('goals.target')}
          doneLabel={t('common.done')}
        />
      </View>
    </Card>
  );

  const deadline = () => (
    <Card>
      <Text size="footnote" color="textMuted">
        {t('goals.deadline')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <Chip
          label={t('goals.deadlineNone')}
          active={values.deadline === null}
          onPress={() => set({ deadline: null })}
        />
        <Chip
          label={
            values.deadline === null
              ? t('goals.deadlinePick')
              : deadlineLabel(values.deadline, today, locale)
          }
          active={values.deadline !== null}
          chevron
          onPress={() => setDateOpen(true)}
        />
      </View>
    </Card>
  );

  const account = () => (
    <Card>
      <Text size="footnote" color="textMuted">
        {t('goals.parent')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {parents.map((candidate) => (
          <Chip
            key={candidate.id}
            label={candidate.name}
            active={candidate.id === values.parentAccountId}
            onPress={() => set({ parentAccountId: candidate.id })}
          />
        ))}
      </View>
      <Text size="footnote" color="textMuted" style={{ marginTop: 16 }}>
        {t('goals.alreadySaved')}
      </Text>
      <View style={{ marginTop: 6 }}>
        <AmountInput
          buffer={values.savedBuffer}
          onChange={(savedBuffer) => set({ savedBuffer })}
          currency={currency}
          locale={locale}
          label={t('goals.alreadySaved')}
          doneLabel={t('common.done')}
        />
      </View>
      {parent === undefined ? null : (
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('goals.freeHint', {
            name: parent.name,
            amount: formatMoney(balances.get(parent.id) ?? 0, currency, locale),
          })}
        </Text>
      )}
    </Card>
  );

  const sheets = (
    <>
      <AppearanceSheet
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        colorIndex={values.colorIndex}
        icon={values.icon}
        groups={categoryIconGroups}
        searchable
        onChange={({ icon, colorIndex }) => set({ icon, colorIndex })}
      />
      <DateSheet
        visible={dateOpen}
        value={values.deadline ?? today}
        today={today}
        title={t('goals.deadline')}
        onSelect={(date) => set({ deadline: date })}
        onClose={() => setDateOpen(false)}
      />
    </>
  );

  const missingLine =
    missing === null ? null : (
      <Text size="footnote" color="textMuted">
        {t(`goals.missing_${missing}`)}
      </Text>
    );

  if (mode === 'edit') {
    return (
      <Screen
        footer={
          <View style={{ gap: 8 }}>
            {missingLine}
            <PrimaryButton label={t('common.save')} disabled={missing !== null} onPress={onSubmit} />
          </View>
        }
      >
        <ScreenHeader title={t('goals.editGoal')} />
        {look()}
        {target()}
        {deadline()}
        {sheets}
      </Screen>
    );
  }

  const last = step === 'account';
  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {missingLine}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {stepIndex === 0 ? null : (
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={t('common.back')}
                  onPress={() => setStepIndex(stepIndex - 1)}
                />
              </View>
            )}
            <View style={{ flex: 2 }}>
              <PrimaryButton
                label={last ? t('goals.create') : t('common.continue')}
                disabled={missing !== null}
                onPress={() => (last ? onSubmit() : setStepIndex(stepIndex + 1))}
              />
            </View>
          </View>
        </View>
      }
    >
      <ScreenHeader title={t('goals.newGoal')} />
      <Stepper step={stepIndex} total={GOAL_STEPS.length} label={t(`goals.step_${step}`)} />
      {step === 'look' ? look() : null}
      {step === 'target' ? target() : null}
      {step === 'deadline' ? deadline() : null}
      {step === 'account' ? account() : null}
      {sheets}
    </Screen>
  );
}
```

- [ ] **Step 6: Routes**

Create `apps/mobile/app/goal/new.tsx`:

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { createGoal } from '../../src/db/goalService';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { GoalForm } from '../../src/features/goals/GoalForm';
import { emptyGoalForm, type GoalFormValues } from '../../src/features/goals/goalFormValues';
import { usePeriod } from '../../src/features/period/PeriodProvider';

/** §6.37. */
export default function NewGoal() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<GoalFormValues>(emptyGoalForm);

  return (
    <GoalForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={() => {
        if (values.parentAccountId === null) return;
        const pocket = createGoal(db, repos, {
          name: values.name.trim(),
          icon: values.icon,
          colorIndex: values.colorIndex,
          parentAccountId: values.parentAccountId,
          goalTarget: amountBufferToMinor(values.buffer, minorDigits),
          goalDeadline: values.deadline,
          alreadySaved: amountBufferToMinor(values.savedBuffer, minorDigits),
          today,
          sortOrder: accounts.length,
        });
        toast.show(t('goals.created'));
        router.replace({ pathname: '/goal/[id]', params: { id: pocket.id } });
      }}
    />
  );
}
```

Create `apps/mobile/app/goal/edit/[id].tsx`:

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotFoundScreen } from '../../../src/components/NotFoundScreen';
import { useToast } from '../../../src/components/Toast';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../../src/db/hooks';
import { GoalForm } from '../../../src/features/goals/GoalForm';
import { type GoalFormValues, goalFormFrom } from '../../../src/features/goals/goalFormValues';

/** §6.37, edit: one page; the parent never changes (§5.14). */
export default function EditGoal() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const account = accounts.find((candidate) => candidate.id === id && candidate.type === 'pocket');
  const [values, setValues] = useState<GoalFormValues | null>(() =>
    account === undefined ? null : goalFormFrom(account, minorDigits),
  );
  const current = values ?? (account === undefined ? null : goalFormFrom(account, minorDigits));
  if (account === undefined || current === null) return <NotFoundScreen />;

  return (
    <GoalForm
      values={current}
      onChange={setValues}
      mode="edit"
      onSubmit={() => {
        repos.accounts.update(account.id, {
          name: current.name.trim(),
          icon: current.icon,
          colorIndex: current.colorIndex,
          goalTarget: amountBufferToMinor(current.buffer, minorDigits),
          goalDeadline: current.deadline,
        });
        toast.show(t('goals.saved'));
        router.back();
      }}
    />
  );
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `rtk proxy pnpm typecheck` and `rtk proxy pnpm --filter mobile test -- src/features/goals`
Expected: pass. If `AppearanceSheet`, `DateSheet`, `Chip` or `TextField` props differ from what is written here, follow the component (AGENTS.md) and fix this plan in the same commit.

```bash
rtk git add apps/mobile/src/features/goals apps/mobile/app/goal
rtk git commit -m "feat(mobile): the goal wizard"
```

---

### Task 7: Detail, close sheet and list

**Files:**
- Create: `apps/mobile/src/features/goals/GoalCloseSheet.tsx`, `apps/mobile/app/goal/[id].tsx`, `apps/mobile/app/goals.tsx`

- [ ] **Step 1: The close sheet**

Create `apps/mobile/src/features/goals/GoalCloseSheet.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { Text } from '../../theme/Text';

export interface GoalCloseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The pocket's balance, formatted; null when it is empty. */
  balanceLabel: string | null;
  parentName: string;
  onRecordExpense: () => void;
  onReturn: () => void;
}

/** §6.38: what happened to the money; with an empty goal it only confirms. */
export function GoalCloseSheet({
  visible,
  onClose,
  balanceLabel,
  parentName,
  onRecordExpense,
  onReturn,
}: GoalCloseSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('goals.close')}>
      <View style={{ gap: 12 }}>
        {balanceLabel === null ? (
          <>
            <Text color="textMuted">{t('goals.closeEmpty')}</Text>
            <PrimaryButton label={t('goals.confirmClose')} onPress={onReturn} />
          </>
        ) : (
          <>
            <Text weight="medium">{t('goals.closeTitle')}</Text>
            <Text color="textMuted">{t('goals.closeBody', { amount: balanceLabel })}</Text>
            <PrimaryButton label={t('goals.recordExpense')} onPress={onRecordExpense} />
            <SecondaryButton
              label={t('goals.returnTo', { name: parentName })}
              onPress={onReturn}
            />
          </>
        )}
      </View>
    </Sheet>
  );
}
```

- [ ] **Step 2: The detail**

Create `apps/mobile/app/goal/[id].tsx`:

```tsx
import { formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { HeaderIconButton, ScreenHeader } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { restoreAccount } from '../../src/db/adminService';
import { closeGoal } from '../../src/db/goalService';
import { useCategories } from '../../src/db/hooks';
import { GoalCloseSheet } from '../../src/features/goals/GoalCloseSheet';
import { goalExpenseParams, goalTransferParams } from '../../src/features/goals/goalLinks';
import { useGoalText } from '../../src/features/goals/useGoalText';
import { useGoalViews } from '../../src/features/goals/useGoalViews';
import { FeaturedTarget } from '../../src/features/targets/FeaturedTarget';
import { transactionRow } from '../../src/features/transactions/transactionRow';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.36. */
export default function GoalDetail() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repos = useRepositories();
  const categories = useCategories();
  const { today } = usePeriod();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { views, accounts, rows, loaded } = useGoalViews();
  const text = useGoalText();
  const { t } = text;
  const [closing, setClosing] = useState(false);

  const view = views.find((candidate) => candidate.account.id === id);
  const account = accounts.find((candidate) => candidate.id === id);
  const movements = useMemo(
    () => rows.filter((tx) => tx.accountId === id || tx.toAccountId === id).slice(0, 30),
    [rows, id],
  );

  if (!loaded) return <Screen>{null}</Screen>;
  if (account === undefined || account.type !== 'pocket') return <NotFoundScreen />;

  // A closed goal is history: the only thing left is to reopen it, empty (§5.14).
  if (view === undefined) {
    return (
      <Screen>
        <ScreenHeader title={account.name} />
        <PrimaryButton
          label={t('common.restore')}
          onPress={() => restoreAccount(repos, account.id)}
        />
      </Screen>
    );
  }

  const parent = view.parent;
  const balance = view.progress.saved;
  const finish = () => {
    closeGoal(db, repos, account.id, today, new Date().toISOString());
    setClosing(false);
    toast.show(t('goals.closed'));
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader
        title={account.name}
        trailing={
          <HeaderIconButton
            icon="pencil"
            label={t('goals.editGoal')}
            onPress={() => router.push({ pathname: '/goal/edit/[id]', params: { id: account.id } })}
          />
        }
      />
      <Card>
        <FeaturedTarget
          icon={account.icon as IconName}
          colour={theme.categoryColor(account.colorIndex)}
          name={account.name}
          meta={text.meta(view, true)}
          amount={balance}
          currency={text.currency}
          locale={text.locale}
          of={text.of(view)}
          ratio={view.progress.ratio}
          pace={text.pace(view)}
          tone={text.tone(view)}
          start={text.ends(view).start}
          end={text.ends(view).end}
          sentence={text.sentence(view)}
          accessibilityLabel={text.label(view)}
        />
      </Card>

      {parent === undefined ? null : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={t('goals.setAside')}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: goalTransferParams(parent.id, account.id, account.name),
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              label={t('goals.withdraw')}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: goalTransferParams(account.id, parent.id, account.name),
                })
              }
            />
          </View>
        </View>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('goals.parent')}
            trailing={<Text color="textMuted">{parent?.name ?? '—'}</Text>}
          />
          <ListRow
            title={t('goals.deadline')}
            trailing={
              <Text color="textMuted">
                {account.goalDeadline == null
                  ? t('goals.deadlineNone')
                  : formatLongDate(account.goalDeadline, text.locale)}
              </Text>
            }
          />
          <ListRow
            title={t('goals.createdOn')}
            trailing={
              <Text color="textMuted">
                {formatLongDate(account.goalStartDate ?? today, text.locale)}
              </Text>
            }
          />
        </View>
      </Card>

      <SectionLabel>{t('goals.movements')}</SectionLabel>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {movements.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('goals.noMovements')}
            </Text>
          ) : (
            movements.map((tx) => {
              const row = transactionRow(tx, {
                category: (categoryId) => categories.find((category) => category.id === categoryId),
                accountName: (accountId) =>
                  accounts.find((candidate) => candidate.id === accountId)?.name ?? '',
                kindLabel: (kind) => t(`kinds.${kind}`),
                viewpointAccountId: account.id,
              });
              return (
                <ListRow
                  key={tx.id}
                  title={row.title}
                  subtitle={row.subtitle}
                  leading={
                    <IconBox name={row.icon} colour={theme.categoryColor(row.colorIndex)} />
                  }
                  trailing={
                    <AmountText
                      plain
                      align="end"
                      minor={row.amount.minor}
                      currency={text.currency}
                      locale={text.locale}
                      signDisplay={row.amount.signDisplay}
                    />
                  }
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                />
              );
            })
          )}
        </View>
      </Card>

      <SecondaryButton label={t('goals.close')} onPress={() => setClosing(true)} />

      <GoalCloseSheet
        visible={closing}
        onClose={() => setClosing(false)}
        balanceLabel={balance > 0 ? text.money(balance) : null}
        parentName={parent?.name ?? ''}
        onRecordExpense={() => {
          setClosing(false);
          router.push({
            pathname: '/transaction/new',
            params: goalExpenseParams(account.id, balance, account.name),
          });
        }}
        onReturn={finish}
      />
    </Screen>
  );
}
```

- [ ] **Step 3: The list**

Create `apps/mobile/app/goals.tsx`:

```tsx
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { IconBox, ListRow } from '../src/components/ListRow';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { SectionLabel } from '../src/components/SectionLabel';
import { useRepositories } from '../src/db/DatabaseProvider';
import { restoreAccount } from '../src/db/adminService';
import { useGoalText } from '../src/features/goals/useGoalText';
import { useGoalViews } from '../src/features/goals/useGoalViews';
import { FeaturedTarget } from '../src/features/targets/FeaturedTarget';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/** §6.35. */
export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repos = useRepositories();
  const { views, accounts, loaded } = useGoalViews();
  const text = useGoalText();
  const { t } = useTranslation();
  const closed = accounts.filter(
    (account) => account.type === 'pocket' && account.archivedAt !== null,
  );
  const create = () => router.push('/goal/new');

  return (
    <Screen refreshable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('goals.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('goals.newGoal')}
          hitSlop={10}
          onPress={create}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {!loaded ? null : views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="bar"
          title={t('goals.empty')}
          body={t('goals.emptyBody')}
          action={{ label: t('goals.newGoal'), onPress: create }}
        />
      ) : (
        views.map((view) => (
          <Card key={view.account.id}>
            <FeaturedTarget
              icon={view.account.icon as IconName}
              colour={theme.categoryColor(view.account.colorIndex)}
              name={view.account.name}
              meta={text.meta(view, true)}
              amount={view.progress.saved}
              currency={text.currency}
              locale={text.locale}
              of={text.of(view)}
              ratio={view.progress.ratio}
              pace={text.pace(view)}
              tone={text.tone(view)}
              start={text.ends(view).start}
              end={text.ends(view).end}
              sentence={text.sentence(view)}
              accessibilityLabel={text.label(view)}
              onPress={() =>
                router.push({ pathname: '/goal/[id]', params: { id: view.account.id } })
              }
            />
          </Card>
        ))
      )}

      {closed.length === 0 ? null : (
        <>
          <SectionLabel>{t('goals.closedSection')}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {closed.map((account) => (
                <ListRow
                  key={account.id}
                  title={account.name}
                  leading={
                    <IconBox name={account.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => restoreAccount(repos, account.id)}
                    >
                      <Text color="accent" weight="medium">
                        {t('common.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `rtk proxy pnpm typecheck`
Expected: pass. Follow the components' real props where they differ (`EmptyState`'s `ghost`, `HeaderIconButton`'s icon names, `formatLongDate`), and fix the plan in the same commit.

```bash
rtk git add apps/mobile/src/features/goals/GoalCloseSheet.tsx "apps/mobile/app/goal/[id].tsx" apps/mobile/app/goals.tsx
rtk git commit -m "feat(mobile): goal detail, close sheet and list"
```

---

### Task 8: Conti, redirects, Profile

**Files:**
- Modify: `apps/mobile/app/(tabs)/accounts.tsx`, `apps/mobile/app/account/[id].tsx`, `apps/mobile/app/settings/archived-accounts.tsx`, `apps/mobile/app/profile.tsx`

- [ ] **Step 1: Pockets under their parent, parents at the bank balance**

In `app/(tabs)/accounts.tsx`:
- add `bankBalance, isPocket, pocketsOf` to the `@saldo/core` import, and import `TargetRing` from `../../src/components/TargetRing`;
- filter pockets out of the three lists and the archived count:

```tsx
  const live = accounts.filter((account) => account.archivedAt === null && !isPocket(account));
  const archived = accounts.filter((account) => account.archivedAt !== null && !isPocket(account));
```

- replace the `row` function with one that shows the bank balance and nests the pockets (§6.5):

```tsx
  const row = (account: (typeof accounts)[number]) => {
    const pockets = pocketsOf(accounts, account.id);
    return (
      <View key={account.id}>
        <ListRow
          title={account.name}
          subtitle={account.institution ?? t(`accountTypes.${account.type}`)}
          leading={
            <IconBox
              name={account.icon as IconName}
              colour={theme.categoryColor(account.colorIndex)}
            />
          }
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          trailing={
            <AmountText
              minor={bankBalance(accounts, balances, account.id)}
              currency={currency}
              locale={locale}
              align="end"
            />
          }
        />
        {pockets.length === 0 ? null : (
          <View style={{ paddingStart: 44, paddingBottom: 4 }}>
            {pockets.map((pocket) => (
              <ListRow
                key={pocket.id}
                title={pocket.name}
                leading={
                  <TargetRing
                    size={theme.layout.targetRingSmall}
                    ratio={
                      (balances.get(pocket.id) ?? 0) / Math.max(1, pocket.goalTarget ?? 1)
                    }
                    pace={null}
                    tone="plain"
                    icon={pocket.icon as IconName}
                    colour={theme.categoryColor(pocket.colorIndex)}
                  />
                }
                onPress={() => router.push({ pathname: '/goal/[id]', params: { id: pocket.id } })}
                trailing={
                  <AmountText
                    minor={balances.get(pocket.id) ?? 0}
                    currency={currency}
                    locale={locale}
                    align="end"
                    size="footnote"
                  />
                }
              />
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
                {t('goals.free')}
              </Text>
              <AmountText
                minor={balances.get(account.id) ?? 0}
                currency={currency}
                locale={locale}
                align="end"
                size="footnote"
                color="textMuted"
              />
            </View>
          </View>
        )}
      </View>
    );
  };
```

- [ ] **Step 2: A pocket's account link lands on its goal**

In `app/account/[id].tsx`, add `Redirect` to the `expo-router` import, and right after the `NotFoundScreen` early return:

```tsx
  // A pocket is a goal (§5.14): its screen is the goal's.
  if (account.type === 'pocket') {
    return <Redirect href={{ pathname: '/goal/[id]', params: { id: account.id } }} />;
  }
```

- [ ] **Step 3: Closed goals are not archived accounts**

In `app/settings/archived-accounts.tsx`:

```tsx
  const archived = accounts.filter(
    (account) => account.archivedAt !== null && account.type !== 'pocket',
  );
```

- [ ] **Step 4: Profile row**

In `app/profile.tsx`, after the Budget `ListRow`:

```tsx
          <ListRow
            title={t('goals.title')}
            leading={lead('piggy')}
            onPress={() => router.push('/goals')}
            chevron
          />
```

- [ ] **Step 5: Check and commit**

Run: `rtk proxy pnpm typecheck` and `rtk proxy pnpm --filter mobile test`
Expected: pass.

```bash
rtk git add "apps/mobile/app/(tabs)/accounts.tsx" "apps/mobile/app/account/[id].tsx" apps/mobile/app/settings/archived-accounts.tsx apps/mobile/app/profile.tsx
rtk git commit -m "feat(mobile): pockets under their parent in Conti, goal redirects, Profile row"
```

---

### Task 9: Verify

- [ ] **Step 1:** `rtk proxy pnpm lint` — no `lint/…`, no `×`; `pnpm exec biome check --write` for formatting.
- [ ] **Step 2:** `rtk proxy pnpm typecheck`.
- [ ] **Step 3:** `CI=1 rtk proxy pnpm test` — read each summary.
- [ ] **Step 4:** On a device (restart Metro with `--clear` and delete `saldo.db` first — the B1 migration):
  1. Profile → Obiettivi → «Nuovo obiettivo»: four steps; a deadline before today is refused.
  2. Home shows the Obiettivi card; «Accantona» from the detail opens a transfer parent → goal.
  3. Conti: the parent reads the bank balance, the goal nested with «liberi».
  4. «Chiudi obiettivo» → «Registra la spesa» → save: the goal closes, what is left returns to the parent.
  5. Reaching a target sends one notification.
- [ ] **Step 5:** Tick `ROADMAP.md` «Plan B» and commit.
