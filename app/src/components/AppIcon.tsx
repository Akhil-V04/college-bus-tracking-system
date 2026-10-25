import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { AppIcons, AppIconsWhite, AppIconName } from '@/constants/icons';
import { useTheme } from '@/contexts/ThemeContext';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
  colorScheme?: 'light' | 'dark' | 'auto';
}

export function AppIcon({ name, size = 24, style, colorScheme = 'auto' }: AppIconProps) {
  const { isDark } = useTheme();
  const useWhite = colorScheme === 'dark' || (colorScheme === 'auto' && isDark);

  const source = useWhite
    ? (AppIconsWhite[name] || AppIcons[name])
    : (AppIcons[name] || AppIconsWhite[name]);

  if (!source) return null;

  return (
    <Image
      source={source}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}

