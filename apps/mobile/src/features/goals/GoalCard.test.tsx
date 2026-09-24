import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GoalCard } from './GoalCard';

async function show(reached: boolean) {
  await render(
    <ThemeProvider preference="dark">
      <GoalCard reached={reached}>
        <Text>Holiday</Text>
      </GoalCard>
    </ThemeProvider>,
  );
}

describe('GoalCard', () => {
  it('has Rocky peek over a reached goal, hidden from screen readers', async () => {
    await show(true);
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('is a plain card for a goal not reached', async () => {
    await show(false);
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.queryByTestId('mascot', { includeHiddenElements: true })).toBeNull();
  });
});
