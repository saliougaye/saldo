import { accountBalances, getCurrency, pocketParentCandidates } from '@saldo/core';
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
import { InfoButton } from '../guide/InfoButton';
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text size="footnote" color="textMuted">
          {t('goals.parent')}
        </Text>
        <InfoButton concept="goals" />
      </View>
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
            <PrimaryButton
              label={t('common.save')}
              disabled={missing !== null}
              onPress={onSubmit}
            />
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
