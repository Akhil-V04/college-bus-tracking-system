import React, {
  Children,
  Component,
  forwardRef,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

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
  children?: ReactNode;
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
  children?: ReactNode;
  onPress?: () => void;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coordinates: Array<{ latitude: number; longitude: number }>,
    options?: any
  ) => void;
};

export type MapView = MapViewRef;

// Declarative marker & polyline stubs for JSX compatibility
export const Marker: React.FC<MarkerProps> = () => null;
export const Polyline: React.FC<PolylineProps> = () => null;

export class MapErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[MapErrorBoundary] Error initializing MapView:', error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>Map Unavailable</Text>
          <Text style={styles.fallbackSub}>
            Live map rendering is temporarily unavailable on this device. Route schedule stops are detailed below.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0B1118; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    .leaflet-control-attribution { display: none !important; }
    
    /* Stop Pin Callout / Badge */
    .stop-marker-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      position: relative;
    }
    .stop-marker-pin {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 11px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
      border: 2px solid #FFFFFF;
      transition: transform 0.15s ease;
    }
    .stop-marker-tip {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      margin-top: -1px;
    }
    .stop-marker-label {
      position: absolute;
      top: -22px;
      background: rgba(15, 23, 42, 0.92);
      color: #F8FAFC;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.22);
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
    
    /* Live Bus Marker */
    .bus-marker-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .bus-marker-halo {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(234, 88, 12, 0.28);
      border: 2.5px solid #EA580C;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 16px rgba(234, 88, 12, 0.75);
      animation: pulse 1.6s infinite ease-in-out;
    }
    .bus-marker-emoji {
      font-size: 24px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
    }
    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.95; }
      50% { transform: scale(1.15); opacity: 0.45; }
      100% { transform: scale(0.95); opacity: 0.95; }
    }
    
    /* Floating Map HUD */
    .map-hud-control {
      position: absolute;
      z-index: 1000;
      background: #1E293B;
      color: #F8FAFC;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 8px;
      padding: 7px 11px;
      font-size: 11.5px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .layer-toggle-btn {
      top: 12px;
      left: 12px;
    }
    .recenter-btn {
      bottom: 24px;
      right: 14px;
      width: 40px;
      height: 40px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="map-hud-control layer-toggle-btn" onclick="toggleLayer()" id="layerBtn">🗺️ Satellite</button>
  <button class="map-hud-control recenter-btn" onclick="resetView()" title="Fit Full Route">↻</button>

  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([17.4705, 78.7255], 12);

    var roadmapLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20
    });
    
    var satelliteLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20
    });

    roadmapLayer.addTo(map);
    var currentLayer = 'roadmap';

    function toggleLayer() {
      if (currentLayer === 'roadmap') {
        map.removeLayer(roadmapLayer);
        satelliteLayer.addTo(map);
        currentLayer = 'satellite';
        document.getElementById('layerBtn').innerText = '🗺️ Roadmap';
      } else {
        map.removeLayer(satelliteLayer);
        roadmapLayer.addTo(map);
        currentLayer = 'roadmap';
        document.getElementById('layerBtn').innerText = '🗺️ Satellite';
      }
    }

    var polylineLayer = null;
    var markersLayer = L.layerGroup().addTo(map);
    var busMarker = null;
    var lastSavedBounds = null;

    function renderData(data) {
      if (!data) return;

      // Render polyline
      if (data.polyline && data.polyline.length > 0) {
        if (polylineLayer) map.removeLayer(polylineLayer);
        var latlngs = data.polyline.map(function(c) { return [c.latitude, c.longitude]; });
        polylineLayer = L.polyline(latlngs, {
          color: data.strokeColor || '#EA580C',
          weight: 4.5,
          opacity: 0.95,
          lineJoin: 'round'
        }).addTo(map);
      }

      // Render markers
      markersLayer.clearLayers();
      if (data.markers && data.markers.length > 0) {
        data.markers.forEach(function(m, idx) {
          if (m.isBus) {
            updateBus(m.coordinate.latitude, m.coordinate.longitude);
            return;
          }
          var color = m.pinColor || '#EA580C';
          var isLast = idx === data.markers.length - 1;
          var label = (idx + 1).toString();
          if (isLast) label = '★';

          var iconHtml = '<div class="stop-marker-wrapper">' +
            '<div class="stop-marker-label">' + (m.title || '') + '</div>' +
            '<div class="stop-marker-pin" style="background-color:' + color + ';">' + label + '</div>' +
            '<div class="stop-marker-tip" style="border-top:6px solid ' + color + ';"></div>' +
            '</div>';

          var customIcon = L.divIcon({
            html: iconHtml,
            className: '',
            iconSize: [26, 32],
            iconAnchor: [13, 32],
            popupAnchor: [0, -32]
          });

          var marker = L.marker([m.coordinate.latitude, m.coordinate.longitude], { icon: customIcon });
          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MARKER_PRESS',
                title: m.title,
                latitude: m.coordinate.latitude,
                longitude: m.coordinate.longitude
              }));
            }
          });
          markersLayer.addLayer(marker);
        });
      }

      if (data.busCoordinate) {
        updateBus(data.busCoordinate.latitude, data.busCoordinate.longitude);
      }

      // Compute and store bounds
      if (data.allCoordinates && data.allCoordinates.length > 0) {
        var b = L.latLngBounds(data.allCoordinates.map(function(c) { return [c.latitude, c.longitude]; }));
        lastSavedBounds = b;
        map.fitBounds(b, { padding: [45, 45] });
      } else if (data.initialRegion) {
        map.setView([data.initialRegion.latitude, data.initialRegion.longitude], 13);
      }
    }

    function resetView() {
      if (lastSavedBounds) {
        map.fitBounds(lastSavedBounds, { padding: [45, 45] });
      }
    }

    function updateBus(lat, lng) {
      if (!busMarker) {
        var busIcon = L.divIcon({
          html: '<div class="bus-marker-wrapper"><div class="bus-marker-halo"><span class="bus-marker-emoji">🚌</span></div></div>',
          className: '',
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });
        busMarker = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        busMarker.setLatLng([lat, lng]);
      }
    }

    function animateToRegion(lat, lng, zoom) {
      map.flyTo([lat, lng], zoom || 15, { duration: 1.0 });
    }

    function fitCoords(coords) {
      if (!coords || coords.length === 0) return;
      var b = L.latLngBounds(coords.map(function(c) { return [c.latitude, c.longitude]; }));
      lastSavedBounds = b;
      map.fitBounds(b, { padding: [45, 45] });
    }

    // Tell React Native the map is loaded
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    }
  </script>
</body>
</html>`;

const CampusMap = forwardRef<MapViewRef, MapViewProps>(
  ({ style, initialRegion, region, children }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [mapReady, setMapReady] = useState(false);

    // Extract Marker and Polyline children
    const { markers, polylines, busCoordinate } = useMemo(() => {
      const extractedMarkers: Array<{
        coordinate: { latitude: number; longitude: number };
        title?: string;
        description?: string;
        pinColor?: string;
        isBus?: boolean;
        key: string | number;
        onPress?: () => void;
      }> = [];

      const extractedPolylines: Array<{
        coordinates: Array<{ latitude: number; longitude: number }>;
        strokeColor?: string;
        strokeWidth?: number;
      }> = [];

      let busCoord: { latitude: number; longitude: number } | null = null;

      Children.forEach(children, (child, index) => {
        if (!isValidElement(child)) return;
        const childProps = (child.props || {}) as any;

        if ('coordinate' in childProps) {
          const isBus =
            Boolean(childProps.title?.includes('Bus')) ||
            Boolean(childProps.description?.includes('Bus')) ||
            String(child.key || '').includes('bus');

          if (isBus && childProps.coordinate) {
            busCoord = childProps.coordinate;
          }

          extractedMarkers.push({
            coordinate: childProps.coordinate,
            title: childProps.title,
            description: childProps.description,
            pinColor: childProps.pinColor,
            isBus,
            key: child.key || `marker-${index}`,
            onPress: childProps.onPress,
          });
        } else if ('coordinates' in childProps) {
          extractedPolylines.push({
            coordinates: childProps.coordinates || [],
            strokeColor: childProps.strokeColor,
            strokeWidth: childProps.strokeWidth,
          });
        }
      });

      return {
        markers: extractedMarkers,
        polylines: extractedPolylines,
        busCoordinate: busCoord,
      };
    }, [children]);

    // All coordinates for auto-fitting
    const allCoordinates = useMemo(() => {
      const coords: Array<{ latitude: number; longitude: number }> = [];
      polylines.forEach((p) => coords.push(...p.coordinates));
      markers.forEach((m) => coords.push(m.coordinate));
      return coords.filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude));
    }, [polylines, markers]);

    // Send payload to WebView
    const syncMapData = useCallback(() => {
      if (!mapReady || !webViewRef.current) return;

      const payload = {
        markers,
        polyline: polylines[0]?.coordinates || [],
        strokeColor: polylines[0]?.strokeColor || '#EA580C',
        busCoordinate,
        allCoordinates,
        initialRegion: region || initialRegion,
      };

      const js = `renderData(${JSON.stringify(payload)}); true;`;
      webViewRef.current.injectJavaScript(js);
    }, [mapReady, markers, polylines, busCoordinate, allCoordinates, region, initialRegion]);

    useEffect(() => {
      syncMapData();
    }, [syncMapData]);

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion: (targetRegion: Region) => {
          if (!webViewRef.current || !targetRegion) return;
          const zoom = Math.round(Math.log2(360 / Math.max(0.005, targetRegion.longitudeDelta)));
          const js = `animateToRegion(${targetRegion.latitude}, ${targetRegion.longitude}, ${zoom}); true;`;
          webViewRef.current.injectJavaScript(js);
        },
        fitToCoordinates: (coords: Array<{ latitude: number; longitude: number }>) => {
          if (!webViewRef.current || !coords || coords.length === 0) return;
          const js = `fitCoords(${JSON.stringify(coords)}); true;`;
          webViewRef.current.injectJavaScript(js);
        },
      }),
      []
    );

    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MAP_READY') {
          setMapReady(true);
        } else if (data.type === 'MARKER_PRESS') {
          const matched = markers.find(
            (m) =>
              m.title === data.title ||
              (Math.abs(m.coordinate.latitude - data.latitude) < 0.0001 &&
                Math.abs(m.coordinate.longitude - data.longitude) < 0.0001)
          );
          if (matched && matched.onPress) {
            matched.onPress();
          }
        }
      } catch {
        // silent
      }
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: LEAFLET_HTML }}
          style={styles.webView}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
        />
        {!mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#EA580C" />
            <Text style={styles.loadingText}>Loading Google Maps...</Text>
          </View>
        )}
      </View>
    );
  }
);

export default CampusMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0B1118',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B1118',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B1118',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  fallbackSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
