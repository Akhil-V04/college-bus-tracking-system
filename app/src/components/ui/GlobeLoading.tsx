import { useEffect, useRef, useMemo } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/theme';

interface GlobeLoadingProps {
  label?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function GlobeLoading({
  label = 'Loading...',
  size = 'medium',
  fullScreen = false,
  style,
}: GlobeLoadingProps) {
  const { colors, isDark } = useTheme();

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const cloudAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // 1. Continuous Clockwise Rotation for Globe & Road (6 seconds per revolution)
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 2. Realistic Bus Suspension Bounce (Road Vibrations)
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -2.5,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 140,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: -1.2,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Gentle Floating Clouds
    const cloudLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cloudAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(cloudAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 4. Subtle Label Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    rotateLoop.start();
    bounceLoop.start();
    cloudLoop.start();
    pulseLoop.start();

    return () => {
      rotateLoop.stop();
      bounceLoop.stop();
      cloudLoop.stop();
      pulseLoop.stop();
    };
  }, [rotateAnim, bounceAnim, cloudAnim, pulseAnim]);

  // Interpolations
  const spinClockwise = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const cloudDriftX = cloudAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 6],
  });

  // Dimensions based on size prop
  const config = useMemo(() => {
    switch (size) {
      case 'small':
        return {
          globeSize: 72,
          busScale: 0.65,
          busOffsetY: -14,
          roadWidth: 7,
          containerPad: 14,
        };
      case 'large':
        return {
          globeSize: 150,
          busScale: 1.15,
          busOffsetY: -24,
          roadWidth: 12,
          containerPad: 28,
        };
      case 'medium':
      default:
        return {
          globeSize: 110,
          busScale: 0.9,
          busOffsetY: -19,
          roadWidth: 9,
          containerPad: 20,
        };
    }
  }, [size]);

  const { globeSize, busScale, busOffsetY, roadWidth } = config;
  const globeRadius = globeSize / 2;

  return (
    <View
      style={[
        styles.wrapper,
        fullScreen && styles.fullScreenWrapper,
        { backgroundColor: fullScreen ? colors.background : 'transparent' },
        style,
      ]}
    >
      <View
        style={[
          styles.stageContainer,
          { width: globeSize + 60, height: globeSize + 60 },
        ]}
      >
        {/* Soft Background Atmosphere / Glow */}
        <View
          style={[
            styles.atmosphereGlow,
            {
              width: globeSize + 40,
              height: globeSize + 40,
              borderRadius: (globeSize + 40) / 2,
              backgroundColor: isDark
                ? 'rgba(14, 165, 233, 0.12)'
                : 'rgba(2, 132, 199, 0.1)',
            },
          ]}
        />

        {/* Floating Cartoon Clouds in Sky */}
        <Animated.View
          style={[
            styles.cloud1,
            {
              transform: [{ translateX: cloudDriftX }],
              top: globeRadius - 25,
              left: 4,
            },
          ]}
        >
          <View
            style={[
              styles.cloudBubble,
              { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
            ]}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.cloud2,
            {
              transform: [{ translateX: Animated.multiply(cloudDriftX, -1) }],
              top: globeRadius - 15,
              right: 2,
            },
          ]}
        >
          <View
            style={[
              styles.cloudBubbleSmall,
              { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
            ]}
          />
        </Animated.View>

        {/* Rotating Globe with Clockwise Spin */}
        <Animated.View
          style={[
            styles.globeContainer,
            {
              width: globeSize,
              height: globeSize,
              borderRadius: globeRadius,
              backgroundColor: isDark ? '#0369A1' : '#0284C7',
              borderColor: isDark ? '#0284C7' : '#38BDF8',
              transform: [{ rotate: spinClockwise }],
            },
          ]}
        >
          {/* Surface Continents (Green/Emerald Landmasses rotating with the earth) */}
          <View style={[styles.landmass, styles.landmass1]} />
          <View style={[styles.landmass, styles.landmass2]} />
          <View style={[styles.landmass, styles.landmass3]} />
          <View style={[styles.landmass, styles.landmass4]} />

          {/* Latitude & Longitude Curved Rings on Globe */}
          <View
            style={[
              styles.globeEquator,
              { borderColor: 'rgba(255, 255, 255, 0.22)' },
            ]}
          />
          <View
            style={[
              styles.globeMeridian,
              { borderColor: 'rgba(255, 255, 255, 0.18)' },
            ]}
          />
        </Animated.View>

        {/* Rotating Road Track (Hugging the Globe Perimeter) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.roadRing,
            {
              width: globeSize + roadWidth * 2,
              height: globeSize + roadWidth * 2,
              borderRadius: (globeSize + roadWidth * 2) / 2,
              borderWidth: roadWidth,
              borderColor: isDark ? '#1E293B' : '#334155',
              transform: [{ rotate: spinClockwise }],
            },
          ]}
        >
          {/* Dashed Centerline on the Road (Marking lane dividers speeding under wheels) */}
          <View
            style={[
              styles.roadDashOverlay,
              {
                width: globeSize + roadWidth * 2 - 2,
                height: globeSize + roadWidth * 2 - 2,
                borderRadius: (globeSize + roadWidth * 2 - 2) / 2,
                borderColor: '#F59E0B',
              },
            ]}
          />
        </Animated.View>

        {/* The Campus Wheels Bus - Perched at Top of Globe, Facing Right with Suspension Bounce */}
        <Animated.View
          style={[
            styles.busAnchor,
            {
              top: globeRadius + busOffsetY,
              transform: [
                { scale: busScale },
                { translateY: bounceAnim },
              ],
            },
          ]}
        >
          {/* Headlight Beam shining forward onto the road */}
          <View style={styles.headlightCone} />

          {/* Bus Body */}
          <View style={styles.busWrapper}>
            {/* Bus Cabin Roof (White/Cream Header) */}
            <View style={styles.busRoof} />

            {/* Main Orange Chassis */}
            <View style={styles.busChassis}>
              {/* Destination board / Route strip */}
              <View style={styles.destinationStrip}>
                <View style={styles.destinationLed} />
              </View>

              {/* Tinted Windows */}
              <View style={styles.windowsRow}>
                <View style={styles.window} />
                <View style={styles.window} />
                <View style={styles.window} />
                <View style={styles.frontWindshield} />
              </View>

              {/* Side Accent Stripe */}
              <View style={styles.chassisStripe} />

              {/* Headlight bulb */}
              <View style={styles.headlightBulb} />
            </View>

            {/* Bus Wheels */}
            <View style={styles.wheelsRow}>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
              <View style={styles.wheel}>
                <View style={styles.wheelHub} />
              </View>
            </View>

            {/* Exhaust Motion Puff / Trail */}
            <View style={styles.exhaustPuff} />
          </View>
        </Animated.View>
      </View>

      {/* Pulsing Loading Label */}
      {Boolean(label) && (
        <Animated.View style={{ opacity: pulseAnim, marginTop: spacing.md }}>
          <Text style={[styles.labelText, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  fullScreenWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  stageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  atmosphereGlow: {
    position: 'absolute',
  },
  // Cloud styles
  cloud1: {
    position: 'absolute',
    zIndex: 1,
  },
  cloud2: {
    position: 'absolute',
    zIndex: 1,
  },
  cloudBubble: {
    width: 22,
    height: 10,
    borderRadius: 6,
    opacity: 0.65,
  },
  cloudBubbleSmall: {
    width: 16,
    height: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  // Globe styles
  globeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  landmass: {
    position: 'absolute',
    backgroundColor: '#10B981', // Emerald green continents
    borderRadius: 20,
    opacity: 0.9,
  },
  landmass1: {
    width: '42%',
    height: '35%',
    top: '15%',
    left: '10%',
    borderRadius: 14,
  },
  landmass2: {
    width: '38%',
    height: '32%',
    bottom: '12%',
    right: '12%',
    borderRadius: 12,
  },
  landmass3: {
    width: '26%',
    height: '24%',
    top: '40%',
    right: '18%',
    borderRadius: 10,
  },
  landmass4: {
    width: '32%',
    height: '22%',
    bottom: '22%',
    left: '20%',
    borderRadius: 8,
  },
  globeEquator: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  globeMeridian: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '48%',
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
  },
  // Road styles
  roadRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  roadDashOverlay: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  // Bus styles
  busAnchor: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  busRoof: {
    width: 44,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 4,
  },
  busChassis: {
    width: 46,
    height: 22,
    backgroundColor: '#EA580C', // Vibrant Campus Wheels Orange
    borderTopRightRadius: 6,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 3,
    borderTopLeftRadius: 2,
    paddingTop: 2,
    paddingHorizontal: 3,
    position: 'relative',
  },
  destinationStrip: {
    width: '85%',
    height: 3,
    backgroundColor: '#0F172A',
    borderRadius: 1.5,
    marginBottom: 2,
    justifyContent: 'center',
    paddingLeft: 2,
  },
  destinationLed: {
    width: 12,
    height: 1.5,
    backgroundColor: '#FDE047',
    borderRadius: 1,
  },
  windowsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  window: {
    width: 7,
    height: 8,
    backgroundColor: '#BAE6FD', // Sky blue window reflection
    borderRadius: 1.5,
  },
  frontWindshield: {
    width: 8,
    height: 9,
    backgroundColor: '#E0F2FE',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 1,
  },
  chassisStripe: {
    position: 'absolute',
    bottom: 4,
    left: 2,
    right: 2,
    height: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
    borderRadius: 1,
  },
  headlightBulb: {
    position: 'absolute',
    bottom: 5,
    right: 1,
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#FEF08A',
  },
  headlightCone: {
    position: 'absolute',
    right: -24,
    top: 10,
    width: 26,
    height: 14,
    backgroundColor: 'rgba(254, 240, 138, 0.3)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    transform: [{ rotate: '8deg' }],
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 36,
    marginTop: -3,
    zIndex: 12,
  },
  wheel: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHub: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  exhaustPuff: {
    position: 'absolute',
    left: -6,
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(203, 213, 225, 0.55)',
  },
  labelText: {
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

