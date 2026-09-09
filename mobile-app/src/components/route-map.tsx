import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

type StopPoint = { id: number; name: string; latitude: number; longitude: number };
type BusPoint = { latitude: number; longitude: number } | null;

export default function RouteMap({ stops, bus }: { stops: StopPoint[]; bus: BusPoint }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.title}>Map preview is available in the Android and iOS app.</Text>
      <Text style={styles.text}>{stops.length} route stops loaded.</Text>
      {bus ? <Text style={styles.live}>Live bus coordinates received.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 180,
    borderRadius: radius.md,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.navy, fontWeight: '800', textAlign: 'center' },
  text: { color: colors.muted },
  live: { color: colors.success, fontWeight: '700' },
});
