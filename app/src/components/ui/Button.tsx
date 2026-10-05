import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, fontWeight } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'lg';
};

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'md',
}: ButtonProps) {
    const { colors } = useTheme();
    const styles = useStyles();
  const variantStyles = useVariantStyles(); const textStyles = useTextStyles(); const variantStyle = variantStyles[variant];
  const variantTextStyle = textStyles[variant];
  const sizeStyle = size === 'lg' ? styles.buttonLg : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        sizeStyle,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.accent}
        />
      ) : (
        <Text style={[styles.buttonText, variantTextStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  buttonLg: { minHeight: 56 },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { fontSize: 15, fontWeight: fontWeight.extrabold, letterSpacing: 0.5 },
}), [colors]);
};

const useVariantStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.accent },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  ghost: { backgroundColor: colors.transparent, borderColor: colors.transparent },
}), [colors]);
};

const useTextStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.accent },
  danger: { color: colors.white },
  ghost: { color: colors.textSecondary },
}), [colors]);
};
