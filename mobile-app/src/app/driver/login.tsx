import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  AppHeader,
  Button,
  Card,
  Field,
  Notice,
  Screen,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
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
    mutationFn: () => apiRequest<LoginResponse>('/auth/login', {
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
    <Screen>
      <AppHeader
        eyebrow="Authorized staff only"
        title="Driver login"
        subtitle="Passengers do not need an account. This login is only for assigned drivers sharing a live trip location."
      />

      <Card>
        <Field
          label="Driver code"
          autoCapitalize="characters"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="For example DRV-001"
        />
        <Field
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Your driver password"
          onSubmitEditing={submit}
        />
        {login.isError ? (
          <Notice
            tone="danger"
            title="Login failed"
            message={login.error.message}
          />
        ) : null}
        <Button
          label="Sign in"
          onPress={submit}
          loading={login.isPending}
          disabled={!identifier.trim() || !password}
        />
      </Card>

      <Text style={styles.help}>
        Driver phone numbers and passwords are stored for administrator use and are never displayed in passenger mode.
      </Text>
      <Button label="Back to passenger view" variant="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.muted, lineHeight: 21, paddingHorizontal: spacing.sm, textAlign: 'center' },
});
