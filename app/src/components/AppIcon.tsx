import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { AppIcons, AppIconName } from '@/constants/icons';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function AppIcon({ name, size = 24, style }: AppIconProps) {
  const source = AppIcons[name];
  if (!source) return null;

  return (
    <Image
      source={source}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
