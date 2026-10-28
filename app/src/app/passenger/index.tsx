import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState, Pill } from '@/components/ui';
import { AppIcon } from '@/components/AppIcon';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { RouteSummary } from '@/types/api';
import { useTheme } from "@/contexts/ThemeContext";

/* ─── Types ─── */
type Message = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: string[];
};

const SUGGESTED_ANSWERS: Record<string, string> = {
  'What should I do if my bus breaks down?': 'In case of a bus breakdown, remain seated calmly and wait for the driver\'s instructions. The driver will report the incident via the driver console and a replacement bus will be arranged. You can also report the issue via the "Report Issue" button.',
  'What are the transport rules?': 'Passengers must carry their valid ID cards, remain seated while the bus is moving, and adhere to the designated route and stop. Unauthorized passengers are strictly prohibited.',
  'How do I report a bus problem?': 'You can report any bus-related problems directly through the "Report Issue" section on your dashboard. Select the issue type, add a brief description, and submit. The transport administration will receive the report instantly.',
  'Who can use the college transport?': 'The college transport is exclusively for assigned students and faculty members who have registered for the academic year. Unauthorized passengers are not allowed to board the buses.',
};

const SUGGESTIONS = Object.keys(SUGGESTED_ANSWERS);

/* ─── Route Card ─── */
function RouteCard({ route }: { route: RouteSummary }) {
    const styles = useStyles();
  const full = route.assignedPassengerCount >= route.capacity;
  return (
    <Pressable
      onPress={() => router.push(`/passenger/${encodeURIComponent(route.routeNo)}`)}
      style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeIdentity}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{route.routeNo}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
            <Text style={styles.routeArea} numberOfLines={1}>{route.areaCovered}</Text>
          </View>
        </View>
        <Pill tone={full ? 'warning' : 'success'}>
          {route.assignedPassengerCount}/{route.capacity}
        </Pill>
      </View>

      {route.isEventOverride ? (
        <View style={styles.eventOverrideCardBadge}>
          <Text style={styles.eventOverrideCardBadgeText}>⚡ Special Event Timetable Active</Text>
        </View>
      ) : null}

      <View style={styles.routeMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>DRIVER</Text>
          <Text style={styles.metaValue}>{route.driver?.name || 'Not assigned'}</Text>
        </View>
        <Text style={styles.viewRoute}>View route →</Text>
      </View>

      {route.hasActiveTrip ? (
        <View style={[styles.liveBanner, route.tripDirection === 'FROM_COLLEGE' && styles.liveBannerReturn]}>
          <View style={[styles.liveDot, route.tripDirection === 'FROM_COLLEGE' && styles.liveDotReturn]} />
          <Text style={[styles.liveText, route.tripDirection === 'FROM_COLLEGE' && styles.liveTextReturn]}>
            {route.tripDirection === 'FROM_COLLEGE' ? '🏠 Return Trip Live (College ➔ Home)' : '🎓 Inbound Live (To College)'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ─── Assistant Overlay Chat ─── */
function AssistantOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { colors } = useTheme();
    const overlayStyles = useOverlayStyles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sessionId = useRef(`session-${Date.now()}`);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation for "thinking" indicator
  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    ).start();
  });

  async function sendMessage(text: string) {
    const userMessage: Message = { id: `user-${Date.now()}`, role: 'USER', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const lowerText = text.toLowerCase();
    
    // Fast keyword matching on frontend for immediate response
    let matchedAnswer = null;
    if (lowerText.match(/(break\s*down|broken|accident|emergency)/i)) {
      matchedAnswer = SUGGESTED_ANSWERS['What should I do if my bus breaks down?'];
    } else if (lowerText.match(/(transport rules|rules|regulations|allowed)/i)) {
      matchedAnswer = SUGGESTED_ANSWERS['What are the transport rules?'];
    } else if (lowerText.match(/(report.*problem|report.*issue|complain)/i)) {
      matchedAnswer = SUGGESTED_ANSWERS['How do I report a bus problem?'];
    } else if (lowerText.match(/(who can use|who is allowed|eligibility)/i)) {
      matchedAnswer = SUGGESTED_ANSWERS['Who can use the college transport?'];
    } else if (SUGGESTED_ANSWERS[text]) {
      matchedAnswer = SUGGESTED_ANSWERS[text];
    }

    if (matchedAnswer) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'ASSISTANT',
          content: matchedAnswer,
          sources: ['Pre-built Knowledge'],
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setLoading(false);
      }, 400);
      return;
    }

    try {
      const response = await apiRequest<{ answer: string; sources: string[] }>(
        '/assistant/chat',
        { method: 'POST', body: JSON.stringify({ question: text, sessionId: sessionId.current }) }
      );
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: response.answer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: 'ASSISTANT', content: `API Error: ${err.message || String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'USER';
    return (
      <View style={[overlayStyles.bubble, isUser ? overlayStyles.userBubble : overlayStyles.aiBubble]}>
        {!isUser && (
          <Text style={overlayStyles.aiLabel}>✦ Transport Assistant</Text>
        )}
        <Text style={[overlayStyles.bubbleText, isUser && overlayStyles.userBubbleText]}>
          {item.content}
        </Text>
        {item.sources && item.sources.length > 0 && (
          <View style={overlayStyles.sourcesBox}>
            <Text style={overlayStyles.sourcesLabel}>Sources:</Text>
            {item.sources.map((s, i) => (
              <Text key={i} style={overlayStyles.sourceItem}>• {s}</Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[overlayStyles.blurFill, { backgroundColor: 'rgba(9, 15, 22, 0.96)' }]}>
        <SafeAreaView style={overlayStyles.safeArea} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
          >
            {/* Overlay Header */}
            <View style={overlayStyles.header}>
              <View style={overlayStyles.headerLeft}>
                <View style={overlayStyles.headerDot} />
                <View>
                  <Text style={overlayStyles.headerTitle}>Transport Assistant</Text>
                  <Text style={overlayStyles.headerSub}>AI-powered • College transport knowledge</Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={({ pressed }) => [overlayStyles.closeBtn, pressed && overlayStyles.closeBtnPressed]}>
                <Text style={overlayStyles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Messages or Empty State */}
            {messages.length === 0 ? (
              <ScrollView contentContainerStyle={overlayStyles.emptyContainer} showsVerticalScrollIndicator={false}>
                <Text style={overlayStyles.emptyIcon}>💬</Text>
                <Text style={overlayStyles.emptyTitle}>Ask me anything</Text>
                <Text style={overlayStyles.emptySubtitle}>
                  Transport policies, emergency procedures, schedules, or bus rules — powered by official college documents.
                </Text>
                <Text style={overlayStyles.suggestLabel}>SUGGESTED</Text>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    style={({ pressed }) => [overlayStyles.chip, pressed && overlayStyles.chipPressed]}
                    onPress={() => sendMessage(s)}
                  >
                    <Text style={overlayStyles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={overlayStyles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* Thinking indicator */}
            {loading && (
              <Animated.View style={[overlayStyles.thinking, { opacity: pulseAnim }]}>
                <Text style={overlayStyles.thinkingText}>✦ Assistant is thinking…</Text>
              </Animated.View>
            )}

            {/* Input */}
            <View style={overlayStyles.inputBar}>
              <TextInput
                style={overlayStyles.textInput}
                placeholder="Ask a question…"
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!loading}
                maxLength={300}
              />
              <Pressable
                style={[overlayStyles.sendBtn, (!input.trim() || loading) && overlayStyles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!input.trim() || loading}
              >
                <Text style={overlayStyles.sendBtnText}>→</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/* ─── Main Dashboard ─── */
export default function PassengerDashboard() {
  const styles = useStyles();
  const { isDark, toggleTheme } = useTheme();
  const [assistantOpen, setAssistantOpen] = useState(false);

  const routes = useQuery({
    queryKey: ['passenger-routes'],
    queryFn: () => apiRequest<RouteSummary[]>('/passenger/routes'),
  });

  // FAB glow pulse
  const fabGlow = useRef(new Animated.Value(0)).current;
  useState(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabGlow, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(fabGlow, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  });

  const fabShadowRadius = fabGlow.interpolate({ inputRange: [0, 1], outputRange: [8, 18] });
  const fabShadowOpacity = fabGlow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.75] });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.headerBackBtn, pressed && { opacity: 0.6 }]}
            hitSlop={10}
            accessibilityLabel="Back to Role Selection"
          >
            <Text style={styles.headerBackIcon}>←</Text>
          </Pressable>
          <View style={styles.headerIcon}>
            <AppIcon name="bus" size={26} />
          </View>
          <Text style={styles.headerTitle}>Campus Transit</Text>
        </View>
        <View style={styles.headerRightActions}>
          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [styles.themeBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Toggle Light or Dark Theme"
          >
            <Text style={styles.themeBtnIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/passenger/notifications')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 8 }]}>
            <AppIcon name="notifications" size={24} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Menu */}
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/search?mode=route')}
        >
          <View style={styles.menuIconBox}>
            <AppIcon name="search" size={22} />
          </View>
          <Text style={styles.menuLabel}>Search by Route Number</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/search?mode=stop')}
        >
          <View style={styles.menuIconBox}>
            <AppIcon name="pin" size={22} />
          </View>
          <Text style={styles.menuLabel}>Bus Stop Near Me</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/emergency')}
        >
          <View style={styles.menuIconBox}>
            <AppIcon name="emergency" size={22} />
          </View>
          <Text style={styles.menuLabel}>Emergency</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={() => router.push('/passenger/report-issue')}
        >
          <View style={styles.menuIconBox}>
            <AppIcon name="report" size={22} />
          </View>
          <Text style={styles.menuLabel}>Report an Issue</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        {/* Routes Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Routes</Text>
          <Pill tone="accent">{routes.data?.length || 0} routes</Pill>
        </View>

        {routes.isPending ? <LoadingState label="Loading college routes..." /> : null}
        {routes.isError ? (
          <ErrorState message={routes.error.message} retry={() => routes.refetch()} />
        ) : null}
        {routes.data && routes.data.length === 0 ? (
          <EmptyState
            title="No routes published"
            message="The transport administrator has not added route services yet."
          />
        ) : null}
        {routes.data?.map((route) => <RouteCard key={route.id} route={route} />)}

        {/* Privacy Notice */}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>🔒 Privacy by design</Text>
          <Text style={styles.privacyText}>
            No account is required. Driver and passenger phone numbers are never shown in passenger mode.
          </Text>
        </View>

        {/* Bottom Actions - Back to Role Selection */}
        <View style={styles.bottomActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.actionBtnText}>← Switch Role (Driver / Passenger)</Text>
          </Pressable>
        </View>

        {/* Branding */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerPowered}>Powered by</Text>
          <Text style={styles.footerBrandName}>CAMPUS<Text style={styles.footerBrandAccent}>Transit</Text></Text>
          <Text style={styles.footerDev}>Developed by Akhil Vadeeboina</Text>
        </View>
      </ScrollView>

      {/* Floating Assistant Button */}
      <Animated.View
        style={[
          styles.fabShadow,
          Platform.OS === 'ios' && { shadowRadius: fabShadowRadius, shadowOpacity: fabShadowOpacity },
        ]}
      >
        <Pressable
          onPress={() => setAssistantOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <AppIcon name="assistant" size={28} />
        </Pressable>
      </Animated.View>

      {/* Assistant Chat Overlay */}
      <AssistantOverlay visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </SafeAreaView>
  );
}

/* ─── Dashboard Styles ─── */
const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  themeBtn: {
    padding: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnIcon: { fontSize: 16 },
  headerBackBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackIcon: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconEmoji: { fontSize: 22 },
  headerTitle: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
    gap: 12,
  },
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemPressed: { borderColor: colors.borderAccent, backgroundColor: colors.surfaceHover },
  menuIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconEmoji: { fontSize: 22 },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  menuChevron: { fontSize: 24, color: colors.textMuted, fontWeight: fontWeight.bold },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
  },
  routeCardPressed: { borderColor: colors.borderAccent, transform: [{ scale: 0.99 }] },
  routeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  routeIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBgStrong,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  routeBadgeText: { color: colors.accent, fontSize: 13, fontWeight: fontWeight.extrabold, letterSpacing: 0.5 },
  routeName: { fontSize: 17, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  routeArea: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  routeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metaItem: { gap: 2 },
  metaLabel: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  metaValue: { color: colors.textPrimary, fontSize: 14, fontWeight: fontWeight.bold },
  viewRoute: { color: colors.accent, fontWeight: fontWeight.extrabold, fontSize: 13 },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 12, fontWeight: fontWeight.bold },
  liveBannerReturn: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  liveDotReturn: {
    backgroundColor: '#A855F7',
  },
  liveTextReturn: {
    color: '#C084FC',
  },
  eventOverrideCardBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  eventOverrideCardBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  privacyBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.sm,
  },
  privacyTitle: { color: colors.textPrimary, fontWeight: fontWeight.extrabold, fontSize: 14 },
  privacyText: { color: colors.textSecondary, lineHeight: 20, fontSize: 13 },
  bottomActions: { gap: 12, marginTop: spacing.sm },
  actionBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnPressed: { backgroundColor: colors.accentBg },
  actionBtnText: { color: colors.accent, fontSize: 15, fontWeight: fontWeight.bold },
  footerBrand: { alignItems: 'center', marginTop: spacing.md, gap: 2 },
  footerPowered: { color: colors.textMuted, fontSize: 13 },
  footerBrandName: { color: colors.accentLight, fontSize: 16, fontWeight: fontWeight.black, letterSpacing: 2 },
  footerBrandAccent: { color: colors.accent, fontWeight: fontWeight.bold },
  footerDev: { color: colors.textMuted, fontSize: 11, marginTop: 4, fontWeight: fontWeight.bold },
  fabShadow: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    zIndex: 100,
    borderRadius: 30,
    ...Platform.select({
      ios: {
        shadowColor: colors.accentLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.5)',
  },
  fabPressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: 0.9 }],
  },
  fabEmoji: { fontSize: 26 },
}), [colors]);
};

/* ─── Overlay Styles ─── */
const useOverlayStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  blurFill: {
    flex: 1,
    backgroundColor: 'rgba(9, 15, 22, 0.3)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: fontWeight.bold },
  headerSub: { color: colors.textMuted, fontSize: 11 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  closeBtnText: { color: colors.textSecondary, fontSize: 16, fontWeight: fontWeight.bold },

  /* Empty state */
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  suggestLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
    width: '100%',
  },
  chipPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  chipText: { color: colors.textSecondary, fontSize: 14 },

  /* Messages */
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.accent,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: 'rgba(22, 28, 36, 0.85)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  aiLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  bubbleText: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
  userBubbleText: { color: colors.textOnAccent },
  sourcesBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sourcesLabel: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.semibold, marginBottom: 2 },
  sourceItem: { color: colors.textSecondary, fontSize: 11 },

  /* Thinking */
  thinking: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  thinkingText: { color: colors.accent, fontSize: 12, fontStyle: 'italic' },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(14, 20, 28, 0.7)',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: colors.textOnAccent, fontSize: 18, fontWeight: fontWeight.bold },
}), [colors]);
};
