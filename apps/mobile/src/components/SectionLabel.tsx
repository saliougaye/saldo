import { Text } from '../theme/Text';

/** Small muted caption above a group (§6). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text size="caption" color="textMuted" weight="medium" style={{ textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
