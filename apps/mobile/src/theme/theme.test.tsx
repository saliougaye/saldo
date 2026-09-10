import { palettes } from '@saldo/ui';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { resolveThemeName, ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const { name, palette } = useTheme();
  return (
    <Text testID="probe" style={{ color: palette.accent }}>
      {name}
    </Text>
  );
}

describe('resolveThemeName', () => {
  it('honours an explicit preference and defaults system to dark', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
    expect(resolveThemeName('dark', 'light')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', undefined)).toBe('dark');
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', 'unspecified')).toBe('dark');
  });
});

describe('ThemeProvider', () => {
  it('exposes the palette of the resolved theme', async () => {
    await render(
      <ThemeProvider preference="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
    expect(screen.getByTestId('probe')).toHaveStyle({ color: palettes.light.accent });
  });

  it('resolves dark for the same tree', async () => {
    await render(
      <ThemeProvider preference="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveStyle({ color: palettes.dark.accent });
  });
});

describe('Text', () => {
  it('applies the token size and converts tracking from em to px', async () => {
    await render(
      <ThemeProvider preference="dark">
        <Text testID="t" size="title" tracking="tighter">
          Saldo
        </Text>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: 24, letterSpacing: -0.48 });
  });

  it('opts into tabular figures only when asked', async () => {
    await render(
      <ThemeProvider preference="dark">
        <Text testID="plain">a</Text>
        <Text testID="amount" tabular>
          1.842,60
        </Text>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('amount')).toHaveStyle({ fontVariant: ['tabular-nums'] });
    expect(screen.getByTestId('plain')).not.toHaveStyle({ fontVariant: ['tabular-nums'] });
  });
});

describe('Icon', () => {
  it('renders the parsed svg nodes of the named icon', async () => {
    await render(
      <ThemeProvider preference="dark">
        <View testID="host">
          <Icon name="battery" size={24} />
        </View>
      </ThemeProvider>,
    );
    // battery parses to rect + path + rect, as asserted in the @saldo/ui icon tests; this checks
    // that Icon maps those nodes onto react-native-svg elements rather than dropping them.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.match(/RNSVGRect/g)).toHaveLength(2);
    expect(tree.match(/RNSVGPath/g)).toHaveLength(1);
  });
});
