import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppearanceSheet } from './AppearanceSheet';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const GROUPS = [{ key: 'accounts', icons: ['landmark', 'card'] as const }];

describe('AppearanceSheet', () => {
  it('reports the colour that was tapped, keeping the icon', async () => {
    const onChange = jest.fn();
    await render(
      <Host>
        <AppearanceSheet
          visible
          onClose={jest.fn()}
          colorIndex={0}
          icon="landmark"
          groups={GROUPS}
          onChange={onChange}
        />
      </Host>,
    );
    // The name, spelled out: a swatch queried through the same key the sheet renders would
    // still match if the key were missing from the catalogue entirely.
    await userEvent.press(screen.getByLabelText('Sage'));
    expect(onChange).toHaveBeenCalledWith({ colorIndex: 3, icon: 'landmark' });
  });

  it('reports the icon that was tapped, keeping the colour', async () => {
    const onChange = jest.fn();
    await render(
      <Host>
        <AppearanceSheet
          visible
          onClose={jest.fn()}
          colorIndex={2}
          icon="landmark"
          groups={GROUPS}
          onChange={onChange}
        />
      </Host>,
    );
    await userEvent.press(screen.getByLabelText('card'));
    expect(onChange).toHaveBeenCalledWith({ colorIndex: 2, icon: 'card' });
  });

  it('offers no search box when there is one short group to look through', async () => {
    await render(
      <Host>
        <AppearanceSheet
          visible
          onClose={jest.fn()}
          colorIndex={0}
          icon="landmark"
          groups={GROUPS}
          onChange={jest.fn()}
        />
      </Host>,
    );
    expect(screen.queryByLabelText('Search icons')).toBeNull();
  });

  it('searches the whole library when asked to', async () => {
    await render(
      <Host>
        <AppearanceSheet
          visible
          onClose={jest.fn()}
          colorIndex={0}
          icon="tag"
          groups={GROUPS}
          searchable
          onChange={jest.fn()}
        />
      </Host>,
    );
    await userEvent.type(screen.getByLabelText('Search icons'), 'piz');
    expect(screen.getByLabelText('pizza')).toBeTruthy();
    // The results replace the groups rather than being appended to them.
    expect(screen.queryByLabelText('landmark')).toBeNull();
  });
});
