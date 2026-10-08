import { useRef, useState, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { useTheme } from "@/contexts/ThemeContext";

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

export default function AssistantScreen() {
    const { colors } = useTheme();
    const styles = useStyles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sessionId = useRef(`session-${Date.now()}`);

  async function sendMessage(text: string) {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (SUGGESTED_ANSWERS[text]) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'ASSISTANT',
          content: SUGGESTED_ANSWERS[text],
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setLoading(false);
      }, 400);
      return;
    }

    try {
      const response = await apiRequest<{ answer: string; sources: string[] }>(
        '/assistant/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            question: text,
            sessionId: sessionId.current,
          }),
        }
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: response.answer,
        sources: response.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'ASSISTANT',
        content: `API Error: ${err.message || String(err)}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
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
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.assistantLabel}>
            <Text style={styles.assistantLabelText}>Transport Assistant</Text>
          </View>
        )}
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {item.content}
        </Text>
        {item.sources && item.sources.length > 0 && (
          <View style={styles.sourcesBox}>
            <Text style={styles.sourcesLabel}>Sources:</Text>
            {item.sources.map((s, i) => (
              <Text key={i} style={styles.sourceItem}>• {s}</Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/'); else router.replace('/'); }} style={styles.backArrow}>
          <Text style={styles.backArrowText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Transport Assistant</Text>
          <Text style={styles.headerSubtitle}>Ask about policies, schedules & procedures</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>College Transport Assistant</Text>
            <Text style={styles.emptySubtitle}>
              Ask me about transport policies, emergency procedures, schedules, or bus rules.
              I answer using official college transport documents.
            </Text>
            <Text style={styles.suggestionsLabel}>Try asking:</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
                onPress={() => sendMessage(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>Assistant is thinking...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
            maxLength={300}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendButtonText}>→</Text>
          </Pressable>
        </View>
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
  headerSubtitle: { color: colors.textMuted, fontSize: fontSize.xs },
  messageList: { padding: spacing.md, paddingBottom: spacing.lg },
  messageBubble: {
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
  assistantBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assistantLabel: { marginBottom: spacing.xs },
  assistantLabelText: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  messageText: { color: colors.textPrimary, fontSize: fontSize.base, lineHeight: 22 },
  userMessageText: { color: colors.textOnAccent },
  sourcesBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  sourcesLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: 2 },
  sourceItem: { color: colors.textSecondary, fontSize: fontSize.xs },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  suggestionsLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    width: '100%',
  },
  suggestionChipPressed: { backgroundColor: colors.surfaceHover },
  suggestionText: { color: colors.textSecondary, fontSize: fontSize.base },
  typingIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typingText: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: colors.textOnAccent, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
}), [colors]);
};
