import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/ui';
import { fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

type AdminNotification = {
  id: number;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'GLOBAL' | 'ROUTE';
  publishedAt: string;
};

function NotificationCard({ item }: { item: AdminNotification }) {
    const { colors } = useTheme();
    const styles = useStyles();
  const isUrgent = item.priority === 'URGENT';
  const isImportant = item.priority === 'IMPORTANT';
  
  const accentColor = isUrgent ? colors.danger : isImportant ? colors.warning : colors.info;
  const bgColor = isUrgent ? colors.dangerBg : isImportant ? colors.warningBg : colors.surface;
  
  return (
    <View style={[styles.card, { borderColor: accentColor, backgroundColor: bgColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={[styles.icon, { color: accentColor }]}>
            {isUrgent ? '🔴' : isImportant ? '🟡' : '🔵'}
          </Text>
          <Text style={[styles.title, { color: accentColor }]}>{item.title}</Text>
        </View>
        <Text style={styles.time}>
          {new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.message}>{item.message}</Text>
      {item.targetType === 'ROUTE' && (
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Pill tone={isUrgent ? 'danger' : 'warning'}>Route Specific</Pill>
        </View>
      )}
    </View>
  );
}

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const styles = useStyles();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => apiRequest<AdminNotification[]>('/admin-notifications'),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          headerTitle: 'Notifications',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Text style={{ fontSize: 24, color: colors.textPrimary }}>‹</Text>
            </Pressable>
          )
        }} 
      />
      
      {isPending ? (
        <View style={styles.center}><LoadingState label="Fetching notifications..." /></View>
      ) : isError ? (
        <View style={styles.center}>
          <ErrorState message={error?.message || 'Failed to load notifications'} retry={refetch} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState 
              title="No Notifications" 
              message="There are no active broadcast announcements right now." 
            />
          }
          renderItem={({ item }) => <NotificationCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  message: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginTop: 4,
  }
}), [colors]);
};
