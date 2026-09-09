import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type StopPoint = { id: number; name: string; latitude: number; longitude: number };
type BusPoint = { latitude: number; longitude: number } | null;

export default function RouteMap({ stops, bus }: { stops: StopPoint[]; bus: BusPoint }) {
  if (!stops.length) return <View style={styles.empty} />;

  const first = stops[0];
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      }}
    >
      <Polyline
        coordinates={stops.map(({ latitude, longitude }) => ({ latitude, longitude }))}
        strokeColor={colors.teal}
        strokeWidth={4}
      />
      {stops.map((stop, index) => (
        <Marker
          key={stop.id}
          coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
          title={(index + 1) + '. ' + stop.name}
          pinColor={colors.navy}
        />
      ))}
      {bus ? (
        <Marker
          coordinate={bus}
          title="Live bus location"
          pinColor={colors.danger}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 280, borderRadius: radius.md },
  empty: { height: 120, borderRadius: radius.md, backgroundColor: colors.border },
});
