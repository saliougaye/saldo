import { mascot } from '@saldo/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { MascotPeek } from '../../components/Mascot';

/**
 * A goal's card (§6.35, §6.36). A reached goal has Rocky peeking over its top edge until it is
 * closed (D26): a state, not an event, so it is drawn from `reached` alone.
 */
export function GoalCard({ reached, children }: { reached: boolean; children: ReactNode }) {
  if (!reached) return <Card>{children}</Card>;
  return (
    <View style={{ paddingTop: mascot.cardWindow }}>
      {/* Before the card, so the card paints over him. */}
      <MascotPeek
        pose="success"
        size={mascot.cardSize}
        window={mascot.cardWindow}
        style={{ position: 'absolute', top: 0, end: mascot.cardInset }}
      />
      <Card>{children}</Card>
    </View>
  );
}
