import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
    const styles = useStyles();
  const { isDark, toggleTheme } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.actionsContainer}>
        <Pressable onPress={toggleTheme} style={styles.themeToggle}>
          <Text style={styles.themeToggleText}>{isDark ? '☀️' : '🌙'}</Text>
        </Pressable>
        {action}
      </View>
    </View>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1, gap: spacing.xs },
  actionsContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  themeToggle: { padding: spacing.xs, borderRadius: 20, backgroundColor: colors.surfaceHover },
  themeToggleText: { fontSize: 18 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: fontWeight.extrabold, lineHeight: 34 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
}), [colors]);
};
