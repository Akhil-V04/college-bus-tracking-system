import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeight } from '@/constants/theme';

type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'live';

export function Pill({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: PillTone }>) {
  const toneStyle = toneStyles[tone] || toneStyles.neutral;
  const textStyle = toneTextStyles[tone] || toneTextStyles.neutral;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, textStyle]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 11, fontWeight: fontWeight.extrabold, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  success: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  warning: { backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warning },
  danger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  info: { backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.info },
  accent: { backgroundColor: colors.accentBgStrong, borderWidth: 1, borderColor: colors.accent },
  live: { backgroundColor: colors.accentBgStrong, borderWidth: 1, borderColor: colors.accent },
});

const toneTextStyles = StyleSheet.create({
  neutral: { color: colors.textSecondary },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  info: { color: colors.info },
  accent: { color: colors.accent },
  live: { color: colors.accent },
});
