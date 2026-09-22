import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepChunk, StepHeader } from './StepHeader';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('it', []);
});

function Host({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

describe('StepHeader', () => {
  it('announces the whole title as one header while drawing it word by word', async () => {
    await render(
      <Host>
        <StepHeader
          step={{ current: 2, total: 4 }}
          title="Il tuo primo conto"
          body="Puoi aggiungerne altri quando vuoi."
        />
      </Host>,
    );
    expect(screen.getByRole('header', { name: 'Il tuo primo conto' })).toBeTruthy();
    expect(screen.getAllByTestId('step-word', { includeHiddenElements: true })).toHaveLength(4);
    expect(screen.getByText('Puoi aggiungerne altri quando vuoi.')).toBeTruthy();
  });

  it('shows the segments for a numbered step, labelled in words', async () => {
    await render(
      <Host>
        <StepHeader step={{ current: 1, total: 4 }} title="Come segui le spese?" body="Scegli." />
      </Host>,
    );
    expect(screen.getByRole('progressbar', { name: 'Passo 1 di 4' })).toBeTruthy();
  });

  it('has no segments on an unnumbered screen (chooser, welcome)', async () => {
    await render(
      <Host>
        <StepHeader title="Come vuoi iniziare?" body="Da zero o no." />
      </Host>,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('StepChunk renders its children', async () => {
    await render(
      <Host>
        <StepChunk index={2}>
          <StepHeader title="X" body="Y" />
        </StepChunk>
      </Host>,
    );
    expect(screen.getByRole('header', { name: 'X' })).toBeTruthy();
  });
});
