import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { type CategorySplitRow, CategorySplitRows } from './CategorySplitRows';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

function Host({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

const ROWS: CategorySplitRow[] = [
  {
    id: 'groceries',
    name: 'Groceries',
    icon: 'cart',
    colour: '#ff0000',
    amount: 41_200,
    delta: 12,
    share: 33,
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: 'car',
    colour: '#00ff00',
    amount: 28_700,
    delta: null,
    share: 23,
  },
];

describe('CategorySplitRows', () => {
  it('captions each row with its delta and its share of the total', async () => {
    await render(
      <Host>
        <CategorySplitRows rows={ROWS} currency="EUR" locale="en" onPress={() => {}} />
      </Host>,
    );
    expect(screen.getByText('+12% · 33% of total')).toBeTruthy();
  });

  it('calls a category new rather than showing a delta it cannot compute', async () => {
    await render(
      <Host>
        <CategorySplitRows rows={ROWS} currency="EUR" locale="en" onPress={() => {}} />
      </Host>,
    );
    expect(screen.getByText('new · 23% of total')).toBeTruthy();
  });

  it('reports which category was pressed', async () => {
    const onPress = jest.fn();
    await render(
      <Host>
        <CategorySplitRows rows={ROWS} currency="EUR" locale="en" onPress={onPress} />
      </Host>,
    );
    await userEvent.press(screen.getByText('Transport'));
    expect(onPress).toHaveBeenCalledWith('transport');
  });
});
