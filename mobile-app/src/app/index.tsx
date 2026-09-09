import { useQuery } from '@tanstack/react-query';
import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LabelValue,
  LoadingState,
  Pill,
  Screen,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { RouteSummary } from '@/types/api';

function RouteCard({ route }: { route: RouteSummary }) {
  const full = route.assignedPassengerCount >= route.capacity;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(('/routes/' + encodeURIComponent(route.routeNo)) as Href)}
      style={({ pressed }) => [styles.routePressable, pressed && styles.pressed]}
    >
      <Card>
        <View style={styles.routeTop}>
          <View style={styles.routeIdentity}>
            <Text style={styles.routeNumber}>Route {route.routeNo}</Text>
            <Text style={styles.routeName}>{route.name}</Text>
          </View>
          <Pill tone={full ? 'warning' : 'success'}>
            {route.assignedPassengerCount}/{route.capacity}
          </Pill>
        </View>
        <Text style={styles.area}>{route.areaCovered}</Text>
        <View style={styles.metaRow}>
          <LabelValue label="Driver" value={route.driver?.name || 'Not assigned'} />
          <Text style={styles.open}>View route</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function PassengerHomeScreen() {
  const routes = useQuery({
    queryKey: ['passenger-routes'],
    queryFn: () => apiRequest<RouteSummary[]>('/passenger/routes'),
  });

  return (
    <Screen>
      <AppHeader
        eyebrow="College transport"
        title="Find your bus"
        subtitle="No passenger login is required. Select the route number assigned by the college."
      />

      <Button
        label="Driver login"
        variant="secondary"
        onPress={() => router.push('/driver/login')}
      />

      {routes.isPending ? <LoadingState label="Loading college routes..." /> : null}
      {routes.isError ? (
        <ErrorState
          message={routes.error.message}
          retry={() => routes.refetch()}
        />
      ) : null}
      {routes.data?.length === 0 ? (
        <EmptyState
          title="No routes published"
          message="The transport administrator has not added route services yet."
        />
      ) : null}
      {routes.data?.map((route) => <RouteCard key={route.id} route={route} />)}

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Privacy by design</Text>
        <Text style={styles.privacyText}>
          Driver and passenger phone numbers are never shown here. Only administrators can view them.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  routePressable: { borderRadius: radius.md },
  pressed: { opacity: 0.78 },
  routeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  routeIdentity: { flex: 1, gap: 2 },
  routeNumber: { color: colors.tealDark, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  routeName: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  area: { color: colors.muted, lineHeight: 20 },
  metaRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  open: { color: colors.tealDark, fontWeight: '800' },
  privacy: { padding: spacing.md, gap: spacing.xs },
  privacyTitle: { color: colors.navy, fontWeight: '800' },
  privacyText: { color: colors.muted, lineHeight: 20 },
});
