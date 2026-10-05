/**
 * Dark-mode design system matching the reference campus-transit UI.
 * Primary palette: deep navy background with burnt-orange accents.
 */

export const colors = {
  // Backgrounds
  background: '#090F16',
  surface: '#161C24',
  surfaceElevated: '#0E141C',
  surfaceHover: '#1F2834',

  // Borders
  border: '#283545',
  borderSubtle: '#1E293B',
  borderAccent: 'rgba(234, 88, 12, 0.4)',

  // Accent (orange)
  accent: '#EA580C',
  accentHover: '#C2410C',
  accentPressed: '#d94e07',
  accentLight: '#F97316',
  accentBg: 'rgba(234, 88, 12, 0.15)',
  accentBgStrong: 'rgba(234, 88, 12, 0.20)',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textOnAccent: '#FFFFFF',

  // Semantic
  success: '#14B8A6',
  successBg: '#0e2722',
  successText: '#86efac',
  danger: '#EF4444',
  dangerBg: '#2A1418',
  dangerBorder: '#5A1E24',
  dangerText: '#ff8089',
  warning: '#F59E0B',
  warningBg: '#2A2014',
  info: '#38BDF8',
  infoBg: '#0c1929',

  // Special
  purple: '#A78BFA',
  live: '#EA580C',
  passed: '#14B8A6',
  upcoming: '#64748B',
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};
