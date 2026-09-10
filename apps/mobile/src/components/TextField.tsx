import { TextInput, type TextInputProps, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.palette.textFaint}
        {...rest}
        style={[
          {
            minHeight: theme.layout.minHitTarget,
            borderRadius: theme.radii.input,
            borderWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: theme.palette.raised,
            paddingHorizontal: 12,
            color: theme.palette.text,
            fontFamily: 'Geist_400Regular',
            fontSize: theme.fontSize.body,
          },
          style,
        ]}
      />
    </View>
  );
}
