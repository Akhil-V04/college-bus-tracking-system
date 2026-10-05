import { PropsWithChildren } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, fontWeight } from '@/constants/theme';

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: fontWeight.extrabold },
});
