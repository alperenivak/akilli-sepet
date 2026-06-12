// =====================================================
// Akıllı Sepet - AI Asistan Chat Ekranı
// Ürün + uygulama + kullanıcı + konum (hibrit asistan)
// =====================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { sendChatMessage, getChatErrorMessage, getAiStatus, type ChatLocation } from '../../src/api/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content:
    'Merhaba, ben Akıllı Sepet. Nasıl yardımcı olabilirim?\n\n'
    + 'Fiyat karşılaştırma, yakın market, sepetiniz, ihbar veya uygulama kullanımı hakkında sorabilirsiniz.',
  timestamp: new Date(),
};

const SUGGESTIONS = [
  'Bana en yakın market nerede?',
  'Sepetimde ne var?',
  'En ucuz süt nerede?',
  'Uygulamayı nasıl kullanırım?',
];

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<ChatLocation | null>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<{ active: boolean; label: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getAiStatus()
      .then((s) => {
        if (s.llm) {
          setLlmStatus({
            active: true,
            label: `Akıllı mod: ${s.provider ?? 'Gemini'}${s.model ? ` (${s.model})` : ''}`,
          });
        } else if (s.geminiConfigured && !s.geminiKeyValid) {
          setLlmStatus({
            active: false,
            label: 'Gemini key tanınmadı — AI Studio key kontrol edin',
          });
        } else {
          setLlmStatus({
            active: false,
            label: 'Temel mod',
          });
        }
      })
      .catch(() => setLlmStatus({ active: false, label: 'Temel mod' }));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationHint('Konum kapalı — yakın market soruları için izin verin');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationHint(null);
      } catch {
        setLocationHint('Konum alınamadı');
      }
    })();
  }, []);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    const historyForApi = [...messages, userMsg]
      .filter((m) => m.id !== '0')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    scrollToEnd();

    try {
      const replyText = await sendChatMessage(trimmed, historyForApi, location);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: replyText,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: getChatErrorMessage(err),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToEnd();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {llmStatus && (
        <View style={[styles.locationBanner, llmStatus.active ? styles.llmOk : styles.llmOff]}>
          <Ionicons
            name={llmStatus.active ? 'sparkles' : 'information-circle-outline'}
            size={14}
            color={llmStatus.active ? '#4f46e5' : '#64748b'}
          />
          <Text style={[styles.locationBannerText, llmStatus.active && { color: '#4f46e5' }]}>
            {llmStatus.label}
          </Text>
        </View>
      )}
      {locationHint && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={14} color="#b45309" />
          <Text style={styles.locationBannerText}>{locationHint}</Text>
        </View>
      )}
      {location && !locationHint && (
        <View style={[styles.locationBanner, styles.locationOk]}>
          <Ionicons name="location" size={14} color="#059669" />
          <Text style={[styles.locationBannerText, { color: '#059669' }]}>
            Konum aktif — yakın market sorularını yanıtlayabilirim
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToEnd}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {item.role === 'assistant' && (
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles" size={14} color="#6366f1" />
                </View>
              )}
              <View style={[styles.bubbleContent, item.role === 'user' && styles.userBubbleContent]}>
                <Text
                  style={[
                    styles.messageText,
                    item.role === 'user' && styles.userMessageText,
                  ]}
                >
                  {item.content}
                </Text>
                <Text style={[styles.messageTime, item.role === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                  {item.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.typingIndicator}>
                <View style={styles.assistantAvatar}>
                  <Ionicons name="sparkles" size={14} color="#6366f1" />
                </View>
                <View style={styles.typingDots}>
                  <ActivityIndicator size="small" color="#6366f1" />
                  <Text style={styles.typingText}>Yanıt hazırlanıyor...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {messages.length <= 1 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsLabel}>Hızlı Sorular</Text>
            <View style={styles.suggestionChips}>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(suggestion)}
                  accessibilityLabel={suggestion}
                >
                  <Text style={styles.suggestionChipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Ürün, market, sepet veya uygulama hakkında sorun..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
            accessibilityLabel="Mesaj yaz"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            accessibilityLabel="Gönder"
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  flex: { flex: 1 },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  locationOk: { backgroundColor: '#ecfdf5', borderBottomColor: '#a7f3d0' },
  llmOk: { backgroundColor: '#eef2ff', borderBottomColor: '#c7d2fe' },
  llmOff: { backgroundColor: '#f8fafc', borderBottomColor: '#e2e8f0' },
  locationBannerText: { flex: 1, fontSize: 12, color: '#b45309' },
  messageList: { padding: 12, gap: 12, paddingBottom: 8 },
  messageBubble: { flexDirection: 'row', gap: 8, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  assistantBubble: { alignSelf: 'flex-start' },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  bubbleContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    maxWidth: '100%',
  },
  userBubbleContent: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    borderTopRightRadius: 4,
    borderTopLeftRadius: 16,
    borderWidth: 0,
  },
  messageText: { fontSize: 14, color: '#333', lineHeight: 21 },
  userMessageText: { color: '#fff' },
  messageTime: { fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: 'flex-end' },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typingText: { fontSize: 12, color: '#888' },
  suggestions: { padding: 12 },
  suggestionsLabel: { fontSize: 12, color: '#888', marginBottom: 8, fontWeight: '600' },
  suggestionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionChipText: { fontSize: 13, color: '#6366f1', fontWeight: '500' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#c7d2fe' },
});
