// =====================================================
// AI Asistan — Gemini (ücretsiz) + OpenAI yedek
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_BASE = `Sen "Akıllı Sepet" — Türkçe konuşan mobil alışveriş asistanısın. Kendini "Akıllı Sepet" olarak tanıt; "Ben Akıllı Sepet, nasıl yardımcı olabilirim?" tarzında samimi konuş.

Görevin: ürün fiyatları, marketler, sepet, ihbar, katalog, uygulama kullanımı ve kullanıcı hesabı hakkında yardımcı olmak.

KURALLAR:
- Aşağıdaki CANLI VERİLER ve ek veri blokları dışında fiyat, adres veya market UYDURMA.
- Veri yoksa dürüstçe söyle; uygulama içi adım öner (konum izni, giriş, sepete ürün ekle).
- Türkçe yanıtla; samimi ama profesyonel ol.
- Uzun sorularda madde madde; kısa sorularda 2-4 cümle yeter.
- Emoji en fazla 2-3.`;

const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

/** Google Gemini key: klasik AIza... veya yeni servis hesaplı AQ.... formatı */
export function isValidGeminiKey(key?: string): boolean {
  if (!key || key.length < 20) return false;
  return key.startsWith('AIza') || key.startsWith('AQ.');
}

@Injectable()
export class AiLlmService {
  private readonly logger = new Logger(AiLlmService.name);
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private activeProvider: 'gemini' | 'openai' | null = null;
  private activeModel: string | null = null;

  constructor(private configService: ConfigService) {}

  private getOpenaiKey(): string | undefined {
    return this.configService.get<string>('ai.openaiApiKey')?.trim() || undefined;
  }

  private getGeminiKey(): string | undefined {
    return this.configService.get<string>('ai.geminiApiKey')?.trim() || undefined;
  }

  private getOpenaiClient(): OpenAI | null {
    const key = this.getOpenaiKey();
    if (!key) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  private getGeminiClient(): GoogleGenerativeAI | null {
    const key = this.getGeminiKey();
    if (!key || !isValidGeminiKey(key)) return null;
    if (!this.gemini) this.gemini = new GoogleGenerativeAI(key);
    return this.gemini;
  }

  isConfigured(): boolean {
    const gemini = this.getGeminiKey();
    const openai = this.getOpenaiKey();
    return !!(isValidGeminiKey(gemini) || openai);
  }

  isAvailable(): boolean {
    return this.isConfigured();
  }

  getStatus(): {
    llm: boolean;
    provider: string | null;
    model: string | null;
    geminiConfigured: boolean;
    geminiKeyValid: boolean;
  } {
    const geminiKey = this.getGeminiKey();
    return {
      llm: this.isConfigured(),
      provider: this.activeProvider,
      model: this.activeModel,
      geminiConfigured: !!geminiKey,
      geminiKeyValid: isValidGeminiKey(geminiKey),
    };
  }

  async complete(
    contextBlock: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string | null> {
    const systemPrompt = `${SYSTEM_BASE}\n\n${contextBlock}`;
    const preferred = this.configService.get<string>('ai.preferredProvider') || 'gemini';

    const geminiKey = this.getGeminiKey();
    if (geminiKey && !isValidGeminiKey(geminiKey)) {
      this.logger.warn(
        'GEMINI_API_KEY taninamadi — AIza... veya AQ.... formatinda olmali (aistudio.google.com/app/apikey)',
      );
    }

    const tryGeminiFirst = preferred === 'gemini' || !this.getOpenaiKey();
    if (tryGeminiFirst) {
      const geminiReply = await this.completeWithGemini(systemPrompt, message, history);
      if (geminiReply) return geminiReply;
    }

    const openai = this.getOpenaiClient();
    if (openai) {
      const openaiReply = await this.completeWithOpenAI(systemPrompt, message, history);
      if (openaiReply) return openaiReply;
    }

    if (!tryGeminiFirst) {
      return this.completeWithGemini(systemPrompt, message, history);
    }

    return null;
  }

  private async completeWithOpenAI(
    systemPrompt: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string | null> {
    const client = this.getOpenaiClient();
    if (!client) return null;

    const model = this.configService.get<string>('ai.openaiModel') || 'gpt-4o-mini';
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8).map((h) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          })),
          { role: 'user', content: message },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (text) {
        this.activeProvider = 'openai';
        this.activeModel = model;
        return text;
      }
    } catch (err) {
      this.logger.warn(`OpenAI hatasi: ${(err as Error).message}`);
    }
    return null;
  }

  private async completeWithGemini(
    systemPrompt: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string | null> {
    const client = this.getGeminiClient();
    if (!client) return null;

    const configured = this.configService.get<string>('ai.geminiModel');
    const models = [...new Set([configured, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))] as string[];

    for (const modelName of models) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const geminiHistory = this.toGeminiHistory(history.slice(-8));

        let text: string | undefined;
        if (geminiHistory.length === 0) {
          text = (await model.generateContent(message)).response.text()?.trim();
        } else {
          const chat = model.startChat({ history: geminiHistory });
          text = (await chat.sendMessage(message)).response.text()?.trim();
        }

        if (text) {
          this.activeProvider = 'gemini';
          this.activeModel = modelName;
          this.logger.log(`Gemini yanit (${modelName})`);
          return text;
        }
      } catch (err) {
        this.logger.warn(`Gemini ${modelName} hatasi: ${(err as Error).message}`);
      }
    }
    return null;
  }

  private toGeminiHistory(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const trimmed = history.filter((h) => h.content?.trim());
    let start = 0;
    while (start < trimmed.length && trimmed[start].role !== 'user') start++;
    const slice = trimmed.slice(start);

    return slice.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));
  }
}
