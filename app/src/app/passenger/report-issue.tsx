import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';

const CATEGORIES = [
  { key: 'DRIVER_BEHAVIOUR', label: 'Driver Behaviour', icon: '👤' },
  { key: 'DRIVING', label: 'Driving / Safety', icon: '🚗' },
  { key: 'BUS_CONDITION', label: 'Bus Condition', icon: '🚌' },
  { key: 'ROUTE_STOP_ISSUE', label: 'Route / Stop Issue', icon: '📍' },
  { key: 'SCHEDULE_ISSUE', label: 'Schedule Issue', icon: '🕐' },
  { key: 'APP_ISSUE', label: 'App Issue', icon: '📱' },
  { key: 'OTHER', label: 'Other', icon: '💬' },
];

// Simple hash for fingerprinting (anti-spam, no identity tracking)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export default function ReportIssueScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selectedCategory || !description.trim()) {
      Alert.alert('Missing Info', 'Please select a category and describe the issue.');
      return;
    }

    setSubmitting(true);
    try {
      const fingerprintHash = simpleHash(
        selectedCategory + description.trim().toLowerCase().slice(0, 50) + new Date().toDateString()
      );

      await apiRequest('/issues/report', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedCategory,
          description: description.trim(),
          additionalInfo: additionalInfo.trim() || null,
          fingerprintHash,
        }),
      });

      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Report Submitted</Text>
          <Text style={styles.successMessage}>
            Thank you. Your report has been received and will be reviewed by the transport office.
            Similar reports are automatically grouped to help prioritize issues.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Report an Issue</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Category Selection */}
          <Text style={styles.sectionLabel}>What kind of issue?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.key && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === cat.key && styles.categoryLabelSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Describe the issue</Text>
          <TextInput
            style={styles.textArea}
            placeholder="What happened? Be as specific as possible..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>

          {/* Additional Info */}
          <Text style={styles.sectionLabel}>Additional details (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Route number, time, location, etc."
            placeholderTextColor={colors.textMuted}
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            maxLength={200}
          />

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              🔒 This report is anonymous. No personal information is collected or stored.
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              submitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backArrow: { padding: spacing.sm, marginRight: spacing.sm },
  backArrowText: { color: colors.accent, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  categoryChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
  },
  categoryIcon: { fontSize: fontSize.lg },
  categoryLabel: { color: colors.textSecondary, fontSize: fontSize.base },
  categoryLabelSelected: { color: colors.accent, fontWeight: fontWeight.semibold },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right', marginTop: 4 },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    padding: spacing.md,
  },
  privacyNote: {
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  privacyText: { color: colors.successText, fontSize: fontSize.sm },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonPressed: { backgroundColor: colors.accentPressed },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.textOnAccent, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    fontSize: 48,
    color: colors.success,
    backgroundColor: colors.successBg,
    width: 80,
    height: 80,
    textAlign: 'center',
    lineHeight: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  successMessage: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backButtonPressed: { backgroundColor: colors.surfaceHover },
  backButtonText: { color: colors.textPrimary, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
