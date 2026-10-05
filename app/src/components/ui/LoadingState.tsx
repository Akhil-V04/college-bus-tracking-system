import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
}), [colors]);
};
