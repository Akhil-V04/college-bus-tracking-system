import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
});
