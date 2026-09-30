'use client';

import {
  type AccountType,
  type CurrencyCode,
  getCurrency,
  type LocalDate,
  type PeriodKind,
  periodContaining,
  sanitizeAmountInput,
} from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoneyParts } from '@saldo/i18n/format';
import { interpolate } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { InstanceInfo } from '../../src/server/instance';
import { Alert } from '../../src/ui/Alert';
import { AmountField } from '../../src/ui/AmountField';
import { AuthFooter, Brand } from '../../src/ui/Brand';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { paletteIndex } from '../../src/ui/IconBox';
import { Select } from '../../src/ui/Select';
import { Steps, stepsBackClass } from '../../src/ui/Steps';
import { TextField } from '../../src/ui/TextField';
import styles from '../(auth)/auth.module.css';
import { finishOnboardingAction } from './actions';
import own from './onboarding.module.css';

export interface OnboardingStrings {
  periodTitle: string;
  periodBody: string;
  /** Templates with `{{start}}`/`{{end}}`, filled here: they depend on the kind and the day chosen. */
  periodTimeline: string;
  cycleTitle: string;
  cycleDay: string;
  cycleTimeline: string;
  accountTitle: string;
  accountBody: string;
  accountName: string;
  accountNamePlaceholder: string;
  accountType: string;
  accountCurrency: string;
  accountBalance: string;
  categoriesTitle: string;
  categoriesBody: string;
  /** A template with `{{count}}`. */
  categoriesSelected: string;
  continue: string;
  back: string;
  start: string;
  working: string;
  error: string;
}

interface Props {
  instance: InstanceInfo;
  locale: AppLocale;
  /** The server's «today», for the period's preview line. */
  today: LocalDate;
  stepLabels: string[];
  strings: OnboardingStrings;
  periodKinds: { value: PeriodKind; label: string; body: string }[];
  accountTypes: { value: Exclude<AccountType, 'pocket'>; label: string; icon: IconName }[];
  currencies: { value: CurrencyCode; label: string; group: string }[];
  categories: { key: string; name: string; icon: IconName; colorIndex: number }[];
}

type Step = 1 | 2 | 3;

/** 1–28, so every month has the day (§5.2), as four rows of seven. */
const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/**
 * Decision 11 of 0.3e-1: the phone's fresh onboarding without the device-only steps — the period,
 * the first account, the categories — and «Inizia» writes all of it at once. The defaults are the
 * phone's (`OnboardingProvider`): the calendar month, day 27, EUR, a checking account, every tile.
 */
export function OnboardingFlow({
  instance,
  locale,
  today,
  stepLabels,
  strings,
  periodKinds,
  accountTypes,
  currencies,
  categories,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [cycleStartDay, setCycleStartDay] = useState(27);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Exclude<AccountType, 'pocket'>>('checking');
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');
  const [balanceBuffer, setBalanceBuffer] = useState('');
  const [selected, setSelected] = useState<string[]>(categories.map((category) => category.key));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new step swaps the heading and every field under it: the focus goes to the new heading
  // rather than dropping to the document with the button that pressed it (as `RegisterFlow`).
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step is the trigger, not a read.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const preview = periodContaining({ kind: periodKind, startDay: cycleStartDay }, today);
  const timeline = interpolate(
    periodKind === 'cycle' ? strings.cycleTimeline : strings.periodTimeline,
    { start: formatDayMonth(preview.start, locale), end: formatDayMonth(preview.end, locale) },
  );

  const { minorDigits } = getCurrency(currency);
  const parts = formatMoneyParts(0, currency, locale);
  const placeholder =
    minorDigits === 0 ? '0' : `0${parts.decimalSeparator}${'0'.repeat(minorDigits)}`;

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  const finish = async () => {
    setFailed(false);
    setBusy(true);
    try {
      const result = await finishOnboardingAction({
        periodKind,
        cycleStartDay,
        currency,
        accountName,
        accountType,
        balanceBuffer,
        // In the grid's order, not the order they were toggled in.
        selectedCategoryKeys: categories
          .map((category) => category.key)
          .filter((key) => selected.includes(key)),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      // `alreadyOnboarded`: a phone (or another tab) finished first, and its rows stand (§8.3).
      if (result.ok || result.error === 'alreadyOnboarded') {
        router.replace('/home');
        return;
      }
    } catch {
      // The action could not be reached: the same sentence, and the draft stays for another try.
    }
    setBusy(false);
    setFailed(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step === 3) void finish();
    else setStep(step === 1 ? 2 : 3);
  };

  const heading = (title: string, body: string) => (
    <>
      <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className={styles.lede}>{body}</p>
    </>
  );

  return (
    <>
      {step > 1 ? (
        <button
          type="button"
          className={stepsBackClass}
          onClick={() => {
            setFailed(false);
            setStep(step === 3 ? 2 : 1);
          }}
        >
          <Icon name="chevL" size={14} />
          {strings.back}
        </button>
      ) : (
        <Brand instanceName={instance.name} />
      )}
      <Steps at={step} total={3} label={stepLabels[step - 1] ?? ''} />

      {/* One form per flow, so Enter in a field is «Continua» — and «Inizia» on the last step. */}
      <form className={styles.form} onSubmit={submit}>
        {step === 1 ? (
          <>
            {heading(strings.periodTitle, strings.periodBody)}
            <fieldset className={own.options}>
              <legend className={own.hidden}>{strings.periodTitle}</legend>
              {periodKinds.map((kind) => (
                <label key={kind.value} className={own.option}>
                  <input
                    type="radio"
                    name="periodKind"
                    value={kind.value}
                    checked={periodKind === kind.value}
                    onChange={() => setPeriodKind(kind.value)}
                    className={own.hidden}
                  />
                  <span className={own.optionText}>
                    <span className={own.optionTitle}>{kind.label}</span>
                    <span className={own.optionBody}>{kind.body}</span>
                  </span>
                  <span className={own.optionCheck} aria-hidden="true">
                    <Icon name="check" size={18} />
                  </span>
                </label>
              ))}
            </fieldset>
            {periodKind === 'cycle' ? (
              <fieldset className={own.days}>
                <legend className={own.daysLegend}>{strings.cycleTitle}</legend>
                <div className={own.dayGrid}>
                  {DAYS.map((day) => (
                    <label key={day} className={own.day}>
                      <input
                        type="radio"
                        name="cycleStartDay"
                        value={day}
                        checked={cycleStartDay === day}
                        onChange={() => setCycleStartDay(day)}
                        aria-label={`${strings.cycleDay} ${day}`}
                        className={own.hidden}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <p className={own.timeline}>{timeline}</p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            {heading(strings.accountTitle, strings.accountBody)}
            <div className={styles.fields}>
              <TextField
                label={strings.accountName}
                placeholder={strings.accountNamePlaceholder}
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                maxLength={60}
                autoComplete="off"
              />
              <Select
                label={strings.accountType}
                value={accountType}
                options={accountTypes}
                onChange={(value) => {
                  const type = accountTypes.find((option) => option.value === value);
                  if (type !== undefined) setAccountType(type.value);
                }}
                placeholder={strings.accountType}
              />
              <Select
                label={strings.accountCurrency}
                value={currency}
                options={currencies.map((option) => ({ ...option, hint: option.value }))}
                onChange={(value) => {
                  const chosen = currencies.find((option) => option.value === value);
                  if (chosen === undefined) return;
                  setCurrency(chosen.value);
                  // The figure typed keeps only the decimals the new currency has (12,50 € becomes
                  // ¥12): the old buffer is not one its field could type, and the server refuses it.
                  const { minorDigits: next } = getCurrency(chosen.value);
                  setBalanceBuffer((buffer) =>
                    sanitizeAmountInput(buffer, next, { allowNegative: true }),
                  );
                }}
                placeholder={strings.accountCurrency}
              />
              <AmountField
                size="body"
                allowNegative
                label={strings.accountBalance}
                buffer={balanceBuffer}
                onChange={setBalanceBuffer}
                minorDigits={minorDigits}
                decimalSeparator={parts.decimalSeparator}
                sign=""
                symbol={parts.symbol}
                symbolPosition={parts.symbolPosition}
                placeholder={placeholder}
              />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            {heading(strings.categoriesTitle, strings.categoriesBody)}
            <p className={own.count} aria-live="polite">
              {interpolate(strings.categoriesSelected, { count: selected.length })}
            </p>
            <ul className={own.tiles} aria-label={strings.categoriesTitle}>
              {categories.map((category) => {
                const on = selected.includes(category.key);
                const index = paletteIndex(category.colorIndex);
                return (
                  <li key={category.key}>
                    <button
                      type="button"
                      className={own.tile}
                      aria-pressed={on}
                      onClick={() => toggle(category.key)}
                      style={
                        on
                          ? {
                              background: `var(--category-${index}-tint)`,
                              color: `var(--category-${index})`,
                            }
                          : undefined
                      }
                    >
                      <Icon name={category.icon} size={20} />
                      <span className={own.tileName}>{category.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {failed ? <Alert body={strings.error} /> : null}
          </>
        ) : null}

        <Button type="submit" busy={busy} busyLabel={strings.working}>
          {step === 3 ? strings.start : strings.continue}
        </Button>
      </form>

      <AuthFooter version={instance.version} host={instance.host} />
    </>
  );
}
