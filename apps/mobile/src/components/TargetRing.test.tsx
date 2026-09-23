import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TargetRing } from './TargetRing';

describe('TargetRing', () => {
  it('stays out of the accessibility tree: the row it sits in says everything', async () => {
    await render(
      <ThemeProvider preference="dark">
        <TargetRing
          testID="ring"
          size={36}
          ratio={0.6}
          pace={0.8}
          tone="attention"
          icon="cart"
          colour="#C57B4E"
        />
      </ThemeProvider>,
    );
    // Hidden from assistive technology on purpose, so the default query would not find it.
    const ring = screen.getByTestId('ring', { includeHiddenElements: true });
    expect(ring.props.accessibilityElementsHidden).toBe(true);
    expect(ring.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
