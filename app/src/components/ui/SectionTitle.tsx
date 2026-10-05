import { PropsWithChildren, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

export function SectionTitle({ children }: PropsWithChildren) {
    const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.extrabold },
}), [colors]);
};
