import { mascot } from '@saldo/ui';
import { View } from 'react-native';
import { Text } from '../theme/Text';
import { Mascot } from './Mascot';

/**
 * A failed import or restore (§13 *Mascot*): Rocky, small and still after one play, above the
 * message. The message says what went wrong on its own; he only sets the tone.
 */
export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Mascot state="error" size={mascot.errorSize} />
      <Text size="footnote" color="accent" style={{ textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}
