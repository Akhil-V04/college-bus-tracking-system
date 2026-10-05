import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

export function LabelValue({ label, value }: { label: string; value: ReactNode }) {
    const styles = useStyles();
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  labelValue: { gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: colors.textPrimary, fontSize: 16, fontWeight: fontWeight.bold },
}), [colors]);
};
