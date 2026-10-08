import { useState, useMemo } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { useTheme } from "@/contexts/ThemeContext";

const CATEGORIES = [
  { key: 'DRIVER_BEHAVIOUR', label: 'Driver Behaviour', icon: '👤' },
  { key: 'DRIVING', label: 'Driving / Safety', icon: '🚗' },
  { key: 'BUS_CONDITION', label: 'Bus Condition', icon: '🚌' },
  { key: 'ROUTE_STOP_ISSUE', label: 'Route / Stop Issue', icon: '📍' },
  { key: 'SCHEDULE_ISSUE', label: 'Schedule Issue', icon: '🕐' },
  { key: 'APP_ISSUE', label: 'App Issue', icon: '📱' },
  { key: 'OTHER', label: 'Other', icon: '💬' },
];

type OptionType = 'checkbox' | 'radio' | 'textarea';

interface CategoryDetails {
  question: string;
  type: OptionType;
  options?: string[];
}

const CATEGORY_DETAILS: Record<string, CategoryDetails> = {
  DRIVER_BEHAVIOUR: {
    question: 'What did you observe?',
    type: 'checkbox',
    options: [
      'Rash / dangerous driving',
      'Overspeeding',
      'Sudden braking',
      'Sudden acceleration',
      'Distracted driving',
      'Not following traffic rules',
      'Misbehaviour with passengers',
      'Other',
    ],
  },
  DRIVING: {
    question: 'What safety issue did you notice?',
    type: 'checkbox',
    options: [
      'Unsafe driving',
      'Unsafe overtaking',
      'Dangerous stopping',
      'Door open while moving',
      'Passenger safety issue',
      'Seat belt / safety equipment issue',
      'Other',
    ],
  },
  BUS_CONDITION: {
    question: 'What is wrong with the bus?',
    type: 'checkbox',
    options: [
      'Seat damage',
      'Window damage',
      'Door problem',
      'Lights not working',
      'Fan / AC problem',
      'Cleanliness / neatness',
      'Broken or loose parts',
      'Electrical issue',
      'Other',
    ],
  },
  ROUTE_STOP_ISSUE: {
    question: 'What is the route/stop problem?',
    type: 'checkbox',
    options: [
      'Bus skipped a stop',
      'Bus did not stop',
      'Wrong route',
      'Route deviation',
      'Incorrect stop location',
      'Stop information is incorrect',
      'Unsafe stopping location',
      'Other',
    ],
  },
  SCHEDULE_ISSUE: {
    question: 'What is the schedule problem?',
    type: 'radio',
    options: [
      'Bus arrived late',
      'Bus left early',
      'Bus did not arrive',
      'Excessive waiting time',
      'Schedule information is incorrect',
      'Other',
    ],
  },
  APP_ISSUE: {
    question: 'What problem are you experiencing?',
    type: 'radio',
    options: [
      'App crash',
      'Login problem',
      'Incorrect information',
      'Feature not working',
      'Slow / loading problem',
      'Notification problem',
      'Other',
    ],
  },
  OTHER: {
    question: 'Describe the issue',
    type: 'textarea',
  },
};

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
    const { colors } = useTheme();
    const styles = useStyles();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  
  // Common details
  const [routeNumber, setRouteNumber] = useState('');
  const [location, setLocation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Clear selections when category changes
  const handleCategorySelect = (key: string) => {
    if (selectedCategory !== key) {
      setSelectedCategory(key);
      setSelectedOptions([]);
      setDescription('');
    }
  };

  const handleOptionToggle = (option: string, type: OptionType) => {
    if (type === 'radio') {
      setSelectedOptions([option]);
    } else if (type === 'checkbox') {
      if (selectedOptions.includes(option)) {
        setSelectedOptions(selectedOptions.filter((o) => o !== option));
      } else {
        if (selectedOptions.length >= 3) {
          Alert.alert('Limit Reached', 'You can select up to 3 options.');
          return;
        }
        setSelectedOptions([...selectedOptions, option]);
      }
    }
  };

  const checkReportLimit = async () => {
    try {
      const today = new Date().toDateString();
      const usageData = await AsyncStorage.getItem('issue_report_usage');
      let usage = usageData ? JSON.parse(usageData) : { date: today, count: 0 };
      
      if (usage.date !== today) {
        usage = { date: today, count: 0 };
      }
      
      if (usage.count >= 3) {
        Alert.alert('Limit Reached', 'You have reached the maximum number of 3 issue reports for today. Please try again tomorrow.');
        return false;
      }
      
      return usage;
    } catch (e) {
      return { date: new Date().toDateString(), count: 0 };
    }
  };

  const incrementReportLimit = async (usage: any) => {
    try {
      usage.count += 1;
      await AsyncStorage.setItem('issue_report_usage', JSON.stringify(usage));
    } catch (e) {
      // ignore
    }
  };

  async function handleSubmit() {
    if (!selectedCategory) {
      Alert.alert('Missing Info', 'Please select a category.');
      return;
    }
    
    const details = CATEGORY_DETAILS[selectedCategory];
    const hasOptions = selectedOptions.length > 0;
    const hasDescription = description.trim().length > 0;
    
    if (details.type === 'textarea' && !hasDescription) {
      Alert.alert('Missing Info', 'Please describe the issue.');
      return;
    }
    
    if ((details.type === 'checkbox' || details.type === 'radio') && !hasOptions && !hasDescription) {
      Alert.alert('Missing Info', 'Please select at least one option or provide a description.');
      return;
    }

    const usage = await checkReportLimit();
    if (!usage) return;

    setSubmitting(true);
    try {
      const fullDescription = hasOptions 
        ? `[${selectedOptions.join(', ')}] ${description.trim()}`
        : description.trim();
        
      const addInfo = [routeNumber ? `Route: ${routeNumber}` : '', location ? `Location: ${location}` : ''].filter(Boolean).join(' | ');

      const fingerprintHash = simpleHash(
        selectedCategory + fullDescription.toLowerCase().slice(0, 50) + new Date().toDateString()
      );

      await apiRequest('/issues/report', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedCategory,
          description: fullDescription,
          additionalInfo: addInfo || null,
          fingerprintHash,
        }),
      });

      await incrementReportLimit(usage);
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
            onPress={() => { if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/'); else router.replace('/'); }}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderCategorySpecifics = () => {
    if (!selectedCategory) return null;
    const details = CATEGORY_DETAILS[selectedCategory];

    return (
      <View style={styles.dynamicSection}>
        <Text style={styles.sectionLabel}>CATEGORY-SPECIFIC DETAILS</Text>
        
        {details.question && <Text style={styles.questionLabel}>{details.question}</Text>}
        
        {details.options && details.options.length > 0 && (
          <View style={styles.optionsList}>
            {details.options.map((option) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => handleOptionToggle(option, details.type)}
                >
                  <View style={styles.optionControlBox}>
                    {details.type === 'radio' ? (
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]} />
                    ) : (
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionLabel}>
          {details.type === 'textarea' ? 'DESCRIPTION' : 'Additional description (Optional)'}
        </Text>
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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/'); else router.replace('/'); }} style={styles.backArrow}>
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
          <Text style={styles.sectionLabel}>WHAT KIND OF ISSUE?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <View key={cat.key} style={styles.categoryCell}>
                <Pressable
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.key && styles.categoryChipSelected,
                  ]}
                  onPress={() => handleCategorySelect(cat.key)}
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
              </View>
            ))}
          </View>

          {/* Dynamic Content Based on Selection */}
          {renderCategorySpecifics()}

          {/* Common fields rendered only when category is selected */}
          {selectedCategory && (
            <>
              {selectedCategory !== 'APP_ISSUE' && (
                <>
                  <Text style={styles.sectionLabel}>OTHER COMMON DETAILS</Text>
                  
                  <Text style={styles.fieldLabel}>Route Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. RT03"
                    placeholderTextColor={colors.textMuted}
                    value={routeNumber}
                    onChangeText={setRouteNumber}
                    maxLength={50}
                  />
                  
                  <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Location</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Where did this happen?"
                    placeholderTextColor={colors.textMuted}
                    value={location}
                    onChangeText={setLocation}
                    maxLength={100}
                  />
                </>
              )}

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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
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
  questionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: 6,
  },
  
  // Grid layout for categories ensuring 2-column symmetry
  categoryGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryCell: {
    width: '48%',
    marginBottom: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    height: 52, // Fixed height for symmetry
    gap: spacing.xs,
  },
  categoryChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
  },
  categoryIcon: { fontSize: fontSize.lg },
  categoryLabel: { 
    color: colors.textSecondary, 
    fontSize: fontSize.sm,
    flex: 1, // Allows text wrapping without breaking layout
  },
  categoryLabelSelected: { color: colors.accent, fontWeight: fontWeight.semibold },
  
  // Dynamic section
  dynamicSection: {
    marginTop: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  optionItemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
  },
  optionControlBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioCircleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxCheck: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontWeight: fontWeight.medium,
  },

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
}), [colors]);
};
