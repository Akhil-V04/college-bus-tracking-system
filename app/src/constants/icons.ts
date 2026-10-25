import { ImageSourcePropType } from 'react-native';

export const AppIcons = {
  bus: require('../../assets/icons/bus.png') as ImageSourcePropType,
  passenger: require('../../assets/icons/passenger.png') as ImageSourcePropType,
  notifications: require('../../assets/icons/notifications.png') as ImageSourcePropType,
  search: require('../../assets/icons/search.png') as ImageSourcePropType,
  pin: require('../../assets/icons/pin.png') as ImageSourcePropType,
  emergency: require('../../assets/icons/emergency.png') as ImageSourcePropType,
  report: require('../../assets/icons/report.png') as ImageSourcePropType,
  assistant: require('../../assets/icons/assistant.png') as ImageSourcePropType,
  driver: require('../../assets/icons/driver.png') as ImageSourcePropType,
  route: require('../../assets/icons/route.png') as ImageSourcePropType,
};

export const AppIconsWhite: Record<keyof typeof AppIcons, ImageSourcePropType> = {
  bus: require('../../assets/icons/bus_white.png') as ImageSourcePropType,
  passenger: require('../../assets/icons/passenger_white.png') as ImageSourcePropType,
  notifications: require('../../assets/icons/notifications_white.png') as ImageSourcePropType,
  search: require('../../assets/icons/search_white.png') as ImageSourcePropType,
  pin: require('../../assets/icons/pin_white.png') as ImageSourcePropType,
  emergency: require('../../assets/icons/emergency_white.png') as ImageSourcePropType,
  report: require('../../assets/icons/report_white.png') as ImageSourcePropType,
  assistant: require('../../assets/icons/assistant_white.png') as ImageSourcePropType,
  driver: require('../../assets/icons/driver_white.png') as ImageSourcePropType,
  route: require('../../assets/icons/route_white.png') as ImageSourcePropType,
};

export type AppIconName = keyof typeof AppIcons;
