import { PropsWithChildren, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'live';

export function Pill({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: PillTone }>) {
    const styles = useStyles();
    const toneStyles = useToneStyles();
    const toneTextStyles = useToneTextStyles();
  const toneStyle = toneStyles[tone] || toneStyles.neutral;
  const textStyle = toneTextStyles[tone] || toneTextStyles.neutral;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, textStyle]}>{children}</Text>
    </View>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 11, fontWeight: fontWeight.extrabold, textTransform: 'uppercase', letterSpacing: 0.5 },
}), [colors]);
};

const useToneStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  success: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  warning: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning },
  danger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  info: { backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.info },
  accent: { backgroundColor: colors.accentBgStrong, borderWidth: 1, borderColor: colors.accent },
  live: { backgroundColor: colors.accentBgStrong, borderWidth: 1, borderColor: colors.accent },
}), [colors]);
};

const useToneTextStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  neutral: { color: colors.textSecondary },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  info: { color: colors.info },
  accent: { color: colors.accent },
  live: { color: colors.accent },
}), [colors]);
};
