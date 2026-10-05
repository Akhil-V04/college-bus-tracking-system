import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, fontWeight, radius } from '@/constants/theme';

type MapStop = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

type BusPosition = {
  latitude: number;
  longitude: number;
};

type RouteMapProps = {
  stops: MapStop[];
  bus?: BusPosition | null;
};

export default function RouteMap({ stops, bus }: RouteMapProps) {
  if (stops.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No stops available to display on map</Text>
      </View>
    );
  }

  const coordinates = stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  const allCoords = bus ? [...coordinates, { latitude: bus.latitude, longitude: bus.longitude }] : coordinates;

  const minLat = Math.min(...allCoords.map((c) => c.latitude));
  const maxLat = Math.max(...allCoords.map((c) => c.latitude));
  const minLng = Math.min(...allCoords.map((c) => c.longitude));
  const maxLng = Math.max(...allCoords.map((c) => c.longitude));

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
      >
        {/* Route polyline */}
        <Polyline
          coordinates={coordinates}
          strokeColor={colors.accent}
          strokeWidth={3}
          lineDashPattern={[6, 4]}
        />

        {/* Stop markers */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
            description={`Stop ${index + 1}`}
            pinColor={index === 0 ? '#A78BFA' : index === stops.length - 1 ? '#EF4444' : colors.accent}
          />
        ))}

        {/* Live bus marker */}
        {bus && (
          <Marker
            coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
            title="Live Bus"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.busMarker}>
              <Text style={styles.busMarkerText}>🚌</Text>
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  placeholder: {
    height: 200,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.textMuted, fontSize: 14 },
  busMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  busMarkerText: { fontSize: 18 },
});

// Dark Google Maps styling
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255d79' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
];
