import { router } from 'expo-router';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontWeight, radius, spacing } from '@/constants/theme';
import { useTheme } from "@/contexts/ThemeContext";

type Role = 'passenger' | 'driver';

export default function RoleSelectionScreen() {
    const styles = useStyles();
  const [selectedRole, setSelectedRole] = useState<Role>('passenger');

  // Animated splash
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContinue = () => {
    if (selectedRole === 'passenger') {
      router.push('/passenger');
    } else {
      router.push('/driver/login');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Branding */}
        <View style={styles.branding}>
          <View style={styles.logoContainer}>
            <View style={styles.logoBg}>
              <Text style={styles.logoEmoji}>🚌</Text>
            </View>
          </View>
          <Text style={styles.brandTitle}>CampusTransit</Text>
          <Text style={styles.brandTag}>COLLEGE BUS TRACKING SYSTEM</Text>
          <Text style={styles.brandSubtitle}>Choose your role to continue</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsRow}>
          {/* Passenger Card */}
          <Pressable
            onPress={() => setSelectedRole('passenger')}
            style={[
              styles.roleCard,
              selectedRole === 'passenger' && styles.roleCardSelected,
            ]}
          >
            {selectedRole === 'passenger' && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            )}
            <View
              style={[
                styles.roleIconContainer,
                selectedRole === 'passenger' && styles.roleIconSelected,
              ]}
            >
              <Text style={styles.roleIcon}>👤</Text>
            </View>
            <Text style={styles.roleTitle}>Passenger</Text>
            <Text style={styles.roleSubtext}>Student / Faculty</Text>
          </Pressable>

          {/* Driver Card */}
          <Pressable
            onPress={() => setSelectedRole('driver')}
            style={[
              styles.roleCard,
              selectedRole === 'driver' && styles.roleCardSelected,
            ]}
          >
            {selectedRole === 'driver' && (
              <View style={styles.checkBadge}>
                <Text style={styles.checkIcon}>✓</Text>
              </View>
            )}
            <View
              style={[
                styles.roleIconContainer,
                selectedRole === 'driver' && styles.roleIconSelected,
              ]}
            >
              <Text style={styles.roleIcon}>🚌</Text>
            </View>
            <Text style={styles.roleTitle}>Bus Driver</Text>
            <Text style={styles.roleSubtext}>Transit Operator</Text>
          </Pressable>
        </View>

        {/* Help Notice */}
        <Text style={styles.helpText}>
          Passengers don't need an account.{' '}
          <Text style={styles.helpLink}>Driver credentials are issued by the transport office.</Text>
        </Text>
      </Animated.View>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
        >
          <Text style={styles.continueBtnText}>
            Continue as {selectedRole === 'passenger' ? 'Passenger' : 'Bus Driver'}
          </Text>
          <Text style={styles.continueArrow}>→</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  branding: { alignItems: 'center', marginBottom: 36 },
  logoContainer: { marginBottom: spacing.md },
  logoBg: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.accentBgStrong,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 36 },
  brandTitle: {
    fontSize: 32,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 3,
    marginTop: 2,
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    opacity: 0.75,
  },
  roleCardSelected: {
    borderColor: colors.accent,
    opacity: 1,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { color: colors.white, fontSize: 13, fontWeight: fontWeight.black },
  roleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  roleIconSelected: {
    backgroundColor: colors.accentBgStrong,
    borderColor: colors.borderAccent,
  },
  roleIcon: { fontSize: 32 },
  roleTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  roleSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  helpLink: { color: colors.accent, fontWeight: fontWeight.semibold },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  continueBtn: {
    height: 56,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  continueBtnPressed: { backgroundColor: colors.accentHover, opacity: 0.92 },
  continueBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  continueArrow: { color: colors.white, fontSize: 20, fontWeight: fontWeight.bold },
}), [colors]);
};
