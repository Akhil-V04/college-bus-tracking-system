import React, {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string;
  anchor?: { x: number; y: number };
  children?: React.ReactNode;
  onPress?: () => void;
};

export type PolylineProps = {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
};

export type MapViewProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  region?: Region;
  provider?: string;
  customMapStyle?: any[];
  children?: React.ReactNode;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coordinates: Array<{ latitude: number; longitude: number }>,
    options?: any
  ) => void;
};

export const Marker: React.FC<MarkerProps> = () => null;
export const Polyline: React.FC<PolylineProps> = () => null;

const CampusMapWeb = forwardRef<MapViewRef, MapViewProps>(
  ({ style, initialRegion, region, children }, ref) => {
    const [currentRegion, setCurrentRegion] = useState<Region>(() => {
      return (
        region ||
        initialRegion || {
          latitude: 17.4334,
          longitude: 78.6837,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }
      );
    });

    const [zoomLevel, setZoomLevel] = useState(1);
    const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion: (newRegion: Region) => {
          if (newRegion && Number.isFinite(newRegion.latitude)) {
            setCurrentRegion(newRegion);
          }
        },
        fitToCoordinates: (coords: Array<{ latitude: number; longitude: number }>) => {
          if (!coords || coords.length === 0) return;
          const lats = coords.map((c) => c.latitude).filter(Number.isFinite);
          const lngs = coords.map((c) => c.longitude).filter(Number.isFinite);
          if (lats.length === 0) return;
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          setCurrentRegion({
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.015, (maxLat - minLat) * 1.3),
            longitudeDelta: Math.max(0.015, (maxLng - minLng) * 1.3),
          });
        },
      }),
      []
    );

    // Extract Marker and Polyline children
    const { markers, polylines } = useMemo(() => {
      const extractedMarkers: Array<{ props: MarkerProps; key: string | number }> = [];
      const extractedPolylines: Array<{ props: PolylineProps; key: string | number }> = [];

      Children.forEach(children, (child, index) => {
        if (!isValidElement(child)) return;
        const childType = (child.type as any)?.name || (child.type as any)?.displayName;

        const childProps = (child.props || {}) as any;
        // Check if child is Marker or Polyline (by type or prop signature)
        if (childType === 'Marker' || 'coordinate' in childProps) {
          extractedMarkers.push({
            props: childProps as MarkerProps,
            key: child.key || `m-${index}`,
          });
        } else if (childType === 'Polyline' || 'coordinates' in childProps) {
          extractedPolylines.push({
            props: childProps as PolylineProps,
            key: child.key || `p-${index}`,
          });
        }
      });

      return { markers: extractedMarkers, polylines: extractedPolylines };
    }, [children]);

    // Calculate view bounds based on currentRegion
    const latDelta = (currentRegion.latitudeDelta || 0.08) / zoomLevel;
    const lngDelta = (currentRegion.longitudeDelta || 0.08) / zoomLevel;
    const minLat = currentRegion.latitude - latDelta / 2;
    const maxLat = currentRegion.latitude + latDelta / 2;
    const minLng = currentRegion.longitude - lngDelta / 2;
    const maxLng = currentRegion.longitude + lngDelta / 2;

    const projectToSvg = useCallback(
      (lat: number, lng: number) => {
        // Clamp & normalize into 0-1000 coordinate space
        const xPercent = (lng - minLng) / (maxLng - minLng || 0.001);
        const yPercent = (maxLat - lat) / (maxLat - minLat || 0.001); // Invert Y because latitude goes up north

        return {
          x: Math.max(-50, Math.min(1050, xPercent * 1000)),
          y: Math.max(-50, Math.min(1050, yPercent * 1000)),
        };
      },
      [minLat, maxLat, minLng, maxLng]
    );

    const zoomIn = () => setZoomLevel((z) => Math.min(z * 1.35, 8));
    const zoomOut = () => setZoomLevel((z) => Math.max(z / 1.35, 0.4));
    const resetZoom = () => {
      setZoomLevel(1);
      if (initialRegion) setCurrentRegion(initialRegion);
    };

    return (
      <View style={[styles.container, style]}>
        {/* Map Canvas with SVG Vector Route Rendering */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.95) 100%),
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
            userSelect: 'none',
          }}
        >
          {/* SVG Layer for Polylines */}
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Compass / Grid lines */}
            <line
              x1="500"
              y1="0"
              x2="500"
              y2="1000"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <line
              x1="0"
              y1="500"
              x2="1000"
              y2="500"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            {/* Polylines */}
            {polylines.map(({ props, key }) => {
              if (!props.coordinates || props.coordinates.length < 2) return null;
              const pointsStr = props.coordinates
                .map((coord) => {
                  const p = projectToSvg(coord.latitude, coord.longitude);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(' ');

              return (
                <g key={key}>
                  {/* Glow shadow for polyline */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke={props.strokeColor || '#EA580C'}
                    strokeWidth={(props.strokeWidth || 4) + 4}
                    strokeOpacity="0.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Main route polyline */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke={props.strokeColor || '#EA580C'}
                    strokeWidth={props.strokeWidth || 4}
                    strokeDasharray={props.lineDashPattern ? props.lineDashPattern.join(' ') : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML Overlay for Markers */}
          {markers.map(({ props, key }) => {
            if (
              !props.coordinate ||
              !Number.isFinite(props.coordinate.latitude) ||
              !Number.isFinite(props.coordinate.longitude)
            ) {
              return null;
            }

            const p = projectToSvg(props.coordinate.latitude, props.coordinate.longitude);
            const anchorX = props.anchor?.x ?? 0.5;
            const anchorY = props.anchor?.y ?? 0.5;
            const markerKey = String(key);
            const isSelected = selectedMarker === markerKey;

            return (
              <div
                key={markerKey}
                onClick={() => {
                  setSelectedMarker((prev) => (prev === markerKey ? null : markerKey));
                  props.onPress?.();
                }}
                style={{
                  position: 'absolute',
                  left: `${(p.x / 10).toFixed(2)}%`,
                  top: `${(p.y / 10).toFixed(2)}%`,
                  transform: `translate(-${anchorX * 100}%, -${anchorY * 100}%)`,
                  cursor: 'pointer',
                  zIndex: isSelected ? 20 : 10,
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {props.children ? (
                  props.children
                ) : (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: props.pinColor || '#EA580C',
                      border: '2.5px solid #ffffff',
                      boxShadow: '0 0 10px rgba(234, 88, 12, 0.6)',
                    }}
                  />
                )}

                {/* Marker Tooltip / Callout */}
                {(isSelected || props.title) && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%) translateY(-6px)',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      backdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                      display: isSelected ? 'block' : 'none',
                    }}
                  >
                    <div>{props.title || 'Stop'}</div>
                    {props.description && (
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>
                        {props.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Web Map HUD Controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 30,
          }}
        >
          <button
            type="button"
            onClick={zoomIn}
            title="Zoom In"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: 'rgba(30, 41, 59, 0.85)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={zoomOut}
            title="Zoom Out"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: 'rgba(30, 41, 59, 0.85)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            -
          </button>
          <button
            type="button"
            onClick={resetZoom}
            title="Reset View"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: 'rgba(30, 41, 59, 0.85)',
              color: '#EA580C',
              border: '1px solid rgba(234, 88, 12, 0.4)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
          >
            ⌖
          </button>
        </div>

        {/* Small Web Map Notice Badge */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            color: '#94a3b8',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ color: '#EA580C' }}>●</span> Web Interactive Map
        </div>
      </View>
    );
  }
);

CampusMapWeb.displayName = 'CampusMapWeb';

export default CampusMapWeb;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
});
