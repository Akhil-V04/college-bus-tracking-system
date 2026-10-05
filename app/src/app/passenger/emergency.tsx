import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Notice } from '@/components/ui';
import { colors, fontWeight, radius, spacing } from '@/constants/theme';

export default function EmergencyScreen() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [serviceType, setServiceType] = useState<'service' | 'bus'>('service');
  const [serviceValue, setServiceValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  const handleSubmit = () => {
    if (!mobileNumber) {
      Alert.alert('Required', 'Please enter your mobile number for emergency callback.');
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      router.back();
    }, 2800);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Report Accident</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        {/* SOS Card */}
        <View style={styles.sosCard}>
          <View style={styles.sosLeft}>
            <Text style={styles.sosTitle}>Are you in Emergency?</Text>
            <Text style={styles.sosDesc}>
              Press <Text style={styles.sosBold}>SOS</Text> button and help will reach you soon
            </Text>
          </View>
          <Pressable
            onPress={() => setSosActive(true)}
            style={({ pressed }) => [styles.sosBtn, pressed && styles.sosBtnPressed]}
          >
            <Text style={styles.sosBtnText}>SOS</Text>
          </Pressable>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder="Enter Mobile Number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Choose Service</Text>
            <View style={styles.radioRow}>
              <Pressable onPress={() => setServiceType('service')} style={styles.radioOption}>
                <View style={[styles.radio, serviceType === 'service' && styles.radioSelected]} />
                <Text style={styles.radioLabel}>Service Number</Text>
              </Pressable>
              <Pressable onPress={() => setServiceType('bus')} style={styles.radioOption}>
                <View style={[styles.radio, serviceType === 'bus' && styles.radioSelected]} />
                <Text style={styles.radioLabel}>Bus Number</Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={serviceValue}
            onChangeText={setServiceValue}
            placeholder={serviceType === 'service' ? 'Enter Service Number (e.g. RT03)' : 'Enter Bus Number (e.g. AP23Z0073)'}
            placeholderTextColor={colors.textMuted}
          />

          <Button
            label="SUBMIT TO CAMPUS FLEET"
            onPress={handleSubmit}
            size="lg"
          />
        </View>

        {submitted && (
          <Notice
            tone="success"
            title="Emergency Incident Dispatched!"
            message="Campus Fleet Central Complaint Cell and Security patrol have received your report."
          />
        )}

        {/* Quick Call */}
        <View style={styles.quickCall}>
          <Text style={styles.quickCallTitle}>Quick Emergency Contacts</Text>
          <View style={styles.contactRow}>
            {[
              { label: 'Campus Security', phone: 'tel:040-27201234' },
              { label: 'Ambulance', phone: 'tel:108' },
              { label: 'Police', phone: 'tel:100' },
            ].map((contact, i) => (
              <Pressable
                key={i}
                onPress={() => Linking.openURL(contact.phone)}
                style={({ pressed }) => [styles.contactCard, pressed && styles.contactCardPressed]}
              >
                <View style={styles.contactIcon}>
                  <Text style={styles.contactIconText}>📞</Text>
                </View>
                <Text style={styles.contactLabel}>{contact.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* SOS Modal */}
      {sosActive && (
        <View style={styles.sosModal}>
          <View style={styles.sosModalContent}>
            <View style={styles.sosModalIcon}>
              <Text style={styles.sosModalEmoji}>⚠️</Text>
            </View>
            <Text style={styles.sosModalTitle}>SOS SIGNAL TRANSMITTED!</Text>
            <Text style={styles.sosModalDesc}>
              Campus Security Patrol and Quick Response Ambulance have pinpointed your GPS coordinates.
            </Text>
            <View style={styles.sosRefBox}>
              <Text style={styles.sosRefText}>Dispatch Ref: #EMG-9024 · Unit en route (ETA ~2 min)</Text>
            </View>
            <Button
              label="DISMISS / CANCEL FALSE ALARM"
              variant="danger"
              onPress={() => setSosActive(false)}
              size="lg"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.white, fontSize: 24, fontWeight: fontWeight.bold },
  headerTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.white },
  content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  sosCard: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sosLeft: { flex: 1, paddingRight: spacing.md },
  sosTitle: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: 16 },
  sosDesc: { color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  sosBold: { color: colors.danger, fontWeight: fontWeight.extrabold },
  sosBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  sosBtnPressed: { backgroundColor: '#B91C1C' },
  sosBtnText: { color: colors.white, fontWeight: fontWeight.black, fontSize: 16, letterSpacing: 2 },
  form: { gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: fontWeight.bold },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 15,
  },
  radioRow: { flexDirection: 'row', gap: spacing.lg },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  radioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  radioLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.medium },
  quickCall: { gap: spacing.md, marginTop: spacing.sm },
  quickCallTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: fontWeight.bold, textAlign: 'center' },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  contactCardPressed: { backgroundColor: colors.accentBg },
  contactIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconText: { fontSize: 14 },
  contactLabel: { color: colors.accent, fontSize: 12, fontWeight: fontWeight.bold, textAlign: 'center' },
  sosModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 50,
  },
  sosModalContent: {
    backgroundColor: '#1C0F12',
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.md,
  },
  sosModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosModalEmoji: { fontSize: 32 },
  sosModalTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: fontWeight.black,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  sosModalDesc: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  sosRefBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.6)',
    borderRadius: radius.md,
    padding: 12,
    width: '100%',
  },
  sosRefText: { color: colors.white, fontSize: 12, fontFamily: 'monospace', textAlign: 'center' },
});
