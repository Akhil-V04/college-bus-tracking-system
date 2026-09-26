import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, fontWeight } from '@/constants/theme';

export function Notice({
  title,
  message,
  tone = 'info',
}: {
  title: string;
  message?: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.notice, toneStyle]}>
      <Text style={styles.noticeTitle}>{title}</Text>
      {message ? <Text style={styles.noticeMessage}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderRadius: radius.sm, borderLeftWidth: 4, padding: 12, gap: 3 },
  noticeTitle: { color: colors.textPrimary, fontWeight: fontWeight.extrabold, fontSize: 14 },
  noticeMessage: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
});

const toneStyles = StyleSheet.create({
  info: { backgroundColor: colors.infoBg, borderLeftColor: colors.info },
  warning: { backgroundColor: colors.warningBg, borderLeftColor: colors.warning },
  danger: { backgroundColor: colors.dangerBg, borderLeftColor: colors.danger },
  success: { backgroundColor: colors.successBg, borderLeftColor: colors.success },
});
