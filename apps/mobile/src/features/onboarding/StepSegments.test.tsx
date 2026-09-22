import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepSegments } from './StepSegments';

describe('StepSegments', () => {
  it('is one progressbar labelled with the step, worth current of total', async () => {
    await render(
      <ThemeProvider preference="dark">
        <StepSegments current={2} total={4} label="Passo 2 di 4" />
      </ThemeProvider>,
    );
    const bar = screen.getByRole('progressbar', { name: 'Passo 2 di 4' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 2 });
  });

  it('draws one segment per step', async () => {
    await render(
      <ThemeProvider preference="dark">
        <StepSegments current={1} total={4} label="Passo 1 di 4" />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId('step-segment', { includeHiddenElements: true })).toHaveLength(4);
  });
});
