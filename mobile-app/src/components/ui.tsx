import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function LabelValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={styles.value}>{value}</Text>
        : value}
    </View>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>) {
  const toneStyle = {
    neutral: styles.pillNeutral,
    success: styles.pillSuccess,
    warning: styles.pillWarning,
    danger: styles.pillDanger,
    info: styles.pillInfo,
  }[tone];
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const variantStyle = {
    primary: styles.button_primary,
    secondary: styles.button_secondary,
    danger: styles.button_danger,
    ghost: styles.button_ghost,
  }[variant];
  const variantTextStyle = {
    primary: styles.buttonText_primary,
    secondary: styles.buttonText_secondary,
    danger: styles.buttonText_danger,
    ghost: styles.buttonText_ghost,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.navy} />
        : <Text style={[styles.buttonText, variantTextStyle]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#829AB1"
        style={[styles.input, props.multiline && styles.inputMultiline]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Notice({
  title,
  message,
  tone = 'info',
}: {
  title: string;
  message?: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const noticeStyle = {
    info: styles.notice_info,
    warning: styles.notice_warning,
    danger: styles.notice_danger,
    success: styles.notice_success,
  }[tone];
  return (
    <View style={[styles.notice, noticeStyle]}>
      <Text style={styles.noticeTitle}>{title}</Text>
      {message ? <Text style={styles.noticeMessage}>{message}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.teal} size="large" />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <Card style={styles.state}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Button label="Try again" onPress={retry} variant="secondary" /> : null}
    </Card>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card style={styles.state}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenContent: {
    flexGrow: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.navyDark, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  labelValue: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillNeutral: { backgroundColor: '#E9EEF3' },
  pillSuccess: { backgroundColor: '#DDF4E8' },
  pillWarning: { backgroundColor: '#FFF2CC' },
  pillDanger: { backgroundColor: '#FDE2E0' },
  pillInfo: { backgroundColor: colors.sky },
  pillText: { color: colors.navy, fontSize: 12, fontWeight: '800' },
  button: {
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  button_primary: { backgroundColor: colors.teal, borderColor: colors.teal },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.teal },
  button_danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { fontSize: 15, fontWeight: '800' },
  buttonText_primary: { color: '#FFFFFF' },
  buttonText_secondary: { color: colors.tealDark },
  buttonText_danger: { color: '#FFFFFF' },
  buttonText_ghost: { color: colors.navy },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  errorText: { color: colors.danger, fontSize: 13 },
  notice: { borderRadius: radius.sm, borderLeftWidth: 4, padding: 12, gap: 3 },
  notice_info: { backgroundColor: colors.sky, borderLeftColor: '#2680C2' },
  notice_warning: { backgroundColor: '#FFF8E1', borderLeftColor: colors.warning },
  notice_danger: { backgroundColor: '#FFF0EF', borderLeftColor: colors.danger },
  notice_success: { backgroundColor: '#E7F8EF', borderLeftColor: colors.success },
  noticeTitle: { color: colors.navy, fontWeight: '800' },
  noticeMessage: { color: colors.muted, lineHeight: 20 },
  state: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateText: { color: colors.muted, textAlign: 'center', lineHeight: 21 },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: '800' },
  emptyTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
});
