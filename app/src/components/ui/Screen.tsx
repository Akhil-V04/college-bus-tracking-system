import { PropsWithChildren, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

export function Screen({
  children,
  scroll = true,
  contentStyle,
  noPadding,
}: PropsWithChildren<{ scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; noPadding?: boolean }>) {
    const styles = useStyles();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, noPadding && styles.noPadding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.fill, noPadding && styles.noPadding, contentStyle]}>
      {children}
    </View>
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

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenContent: {
    flexGrow: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  noPadding: { padding: 0, paddingBottom: 0 },
}), [colors]);
};
