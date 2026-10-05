import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, Notice } from '@/components/ui';
import { colors, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { saveDriverToken } from '@/lib/auth';

type LoginResponse = {
  token: string;
  role: 'driver';
  id: number;
  name: string;
};

export default function DriverLoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () =>
      apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          role: 'driver',
          identifier: identifier.trim(),
          password,
        }),
      }),
    onSuccess: async (result) => {
      await saveDriverToken(result.token);
      router.replace('/driver');
    },
  });

  const submit = () => {
    if (!identifier.trim() || !password) return;
    login.mutate();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Driver Login</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        {/* Branding */}
        <View style={styles.branding}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🔐</Text>
          </View>
          <Text style={styles.brandTag}>AUTHORIZED STAFF ONLY</Text>
          <Text style={styles.brandSubtitle}>
            Passengers don't need an account. This login is only for assigned bus drivers.
          </Text>
        </View>

        {/* Form */}
        <Card>
          <Field
            label="Driver code"
            autoCapitalize="characters"
            autoCorrect={false}
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (login.isError) login.reset();
            }}
            placeholder="For example DRV-001"
          />
          <Field
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (login.isError) login.reset();
            }}
            placeholder="Your driver password"
            onSubmitEditing={submit}
          />
          {login.isError && (
            <Notice
              tone="danger"
              title="Login failed"
              message={login.error.message}
            />
          )}
          <Button
            label="Sign in"
            onPress={submit}
            loading={login.isPending}
            disabled={!identifier.trim() || !password}
            size="lg"
          />
        </Card>

        <Text style={styles.helpText}>
          Driver phone numbers and passwords are stored securely. They are never visible in passenger mode.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.replace('/passenger')}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
        >
          <Text style={styles.ghostBtnText}>← Back to passenger view</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.white, fontSize: 24, fontWeight: fontWeight.bold },
  headerTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.white },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  branding: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentBgStrong,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 28 },
  brandTag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  helpText: {
    color: colors.textMuted,
    lineHeight: 21,
    textAlign: 'center',
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  ghostBtnPressed: { backgroundColor: colors.surface },
  ghostBtnText: { color: colors.textSecondary, fontWeight: fontWeight.bold, fontSize: 15 },
});
