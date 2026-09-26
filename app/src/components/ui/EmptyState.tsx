import { StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { colors, spacing, fontWeight } from '@/constants/theme';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card style={styles.state}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.extrabold },
});
