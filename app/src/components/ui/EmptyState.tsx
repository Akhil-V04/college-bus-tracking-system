import { StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

export function EmptyState({ title, message }: { title: string; message: string }) {
    const styles = useStyles();
  return (
    <Card style={styles.state}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </Card>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.extrabold },
}), [colors]);
};
