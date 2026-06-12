import api from './client';
import { getApiErrorMessage } from '../utils/constants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatLocation {
  latitude: number;
  longitude: number;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  location?: ChatLocation | null,
): Promise<string> {
  const res = await api.post<{ data: { response: string } }>('/ai/chat', {
    message,
    history: history.slice(-8),
    ...(location && {
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  });
  const text = res.data?.data?.response;
  if (text?.trim()) return text.trim();
  throw new Error('Yanıt alınamadı');
}

export async function getAiStatus(): Promise<{
  llm: boolean;
  provider: string | null;
  model: string | null;
  geminiConfigured?: boolean;
  geminiKeyValid?: boolean;
  hint?: string;
}> {
  const res = await api.get<{
    data: {
      llm: boolean;
      provider: string | null;
      model: string | null;
      geminiConfigured?: boolean;
      geminiKeyValid?: boolean;
      hint?: string;
    };
  }>('/ai/status');
  return res.data?.data ?? { llm: false, provider: null, model: null };
}

export function getChatErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404) {
    return 'AI servisi bulunamadı. Backend güncel mi çalışıyor kontrol edin.';
  }
  if (!status && (err as { message?: string })?.message?.includes('Network')) {
    return 'Sunucuya bağlanılamadı. Wi‑Fi ve backend (3001) adresini kontrol edin.';
  }
  return getApiErrorMessage(err, 'Şu an yanıt veremiyorum. Lütfen tekrar deneyin.');
}
