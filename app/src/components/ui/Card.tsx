import { PropsWithChildren, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
    const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
}), [colors]);
};
