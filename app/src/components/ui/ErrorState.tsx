import { StyleSheet, Text } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
    const styles = useStyles();
  return (
    <Card style={styles.state}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Button label="Try again" onPress={retry} variant="secondary" /> : null}
    </Card>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: fontWeight.extrabold },
}), [colors]);
};
