import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { radius, spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
    const { colors } = useTheme();
    const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, props.multiline && styles.inputMultiline]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: fontWeight.bold },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  errorText: { color: colors.danger, fontSize: 13 },
}), [colors]);
};
