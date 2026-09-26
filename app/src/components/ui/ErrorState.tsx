import { StyleSheet, Text } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { colors, spacing, fontWeight } from '@/constants/theme';

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Card style={styles.state}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Button label="Try again" onPress={retry} variant="secondary" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: fontWeight.extrabold },
});
