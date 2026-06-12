// =====================================================
// Akıllı Sepet - Akilli Alisveris Asistan Servisi
//
// Hibrit: Canlı bağlam (ürün + kullanıcı + konum) + LLM (opsiyonel) + kural motoru
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AiContextService, type AssistantContext, type ChatOptions } from './ai-context.service';
import { AiLlmService } from './ai-llm.service';

// Fiyat formatlama yardimcisi
const formatTL = (kurus: number) => `₺${(kurus / 100).toFixed(2)}`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Opsiyonel: Gelismis AI API'leri (bos birakilabilir)
  private hasOpenAI: boolean;
  private hasGemini: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private contextService: AiContextService,
    private llmService: AiLlmService,
  ) {
    this.hasOpenAI = !!this.configService.get<string>('ai.openaiApiKey');
    this.hasGemini = !!this.configService.get<string>('ai.geminiApiKey');

    if (this.hasOpenAI) this.logger.log('OpenAI API key mevcut');
    if (this.hasGemini) this.logger.log('Gemini API key mevcut');
    if (!this.hasOpenAI && !this.hasGemini) {
      this.logger.warn(
        'LLM kapali — GEMINI_API_KEY ekleyin (ucretsiz): https://aistudio.google.com/app/apikey',
      );
    }
  }

  getLlmStatus() {
    return this.llmService.getStatus();
  }

  isLlmEnabled(): boolean {
    return this.llmService.isAvailable();
  }

  // =====================================================
  // CHATBOT — Ana giris noktasi
  // =====================================================
  async chat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: ChatOptions = {},
  ): Promise<string> {
    const ctx = await this.contextService.build(options);
    const lowerMsg = message.toLowerCase().trim();
    let contextBlock = this.contextService.formatForPrompt(ctx);

    // Fiyat sorusu varsa ham veriyi bağlama ekle (LLM uydurmasın)
    const priceMatch = this.extractProductFromPriceQuery(lowerMsg);
    if (priceMatch) {
      const priceData = await this.handlePriceQuery(priceMatch);
      contextBlock += `\n\n=== GÜNCEL FİYAT VERİSİ (birebir kullan) ===\n${priceData}`;
    }

    // 1) LLM öncelikli — ChatGPT tarzı serbest sohbet (Gemini ücretsiz / OpenAI)
    if (this.llmService.isAvailable()) {
      const llmReply = await this.llmService.complete(
        contextBlock,
        message,
        conversationHistory,
      );
      if (llmReply) return llmReply;
    }

    // 2) LLM yoksa veya hata — kural motoru
    const structured = await this.tryStructuredIntent(lowerMsg, message, ctx);
    if (structured) return structured;

    return this.composeContextualFallback(message, lowerMsg, ctx);
  }

  // =====================================================
  // NİYET YÖNLENDİRME — ürün + uygulama + kullanıcı
  // =====================================================
  private async tryStructuredIntent(
    lowerMsg: string,
    rawMessage: string,
    ctx: AssistantContext,
  ): Promise<string | null> {
    // Konum / yakın market
    if (this.isNearbyIntent(lowerMsg)) {
      return this.handleNearbyMarkets(ctx);
    }

    // Kullanıcı sepeti
    if (/sepetim|sepette ne|sepetimde|sepet özeti|sepet ozeti|sepetimdeki/.test(lowerMsg)) {
      return this.handleMyCart(ctx);
    }

    // İhbarlarım
    if (/ihbarlarım|ihbarlarim|ihbar durum|bildirimlerim|ihbar takip/.test(lowerMsg)) {
      return this.handleMyReports(ctx);
    }

    // Fiyat uyarıları / bildirimler
    if (/fiyat uyarı|fiyat uyar|uyarılarım|uyarilarim|okunmamış bildirim/.test(lowerMsg)) {
      return this.handleMyAlerts(ctx);
    }

    // Hesap / profil
    if (/profilim|hesabım|hesabim|giriş yap|giris yap|kayıt ol|kayit ol|üye ol|uye ol/.test(lowerMsg)) {
      return this.handleAccount(ctx, lowerMsg);
    }

    // Uygulama kullanımı
    if (this.isAppHelpIntent(lowerMsg)) {
      return this.handleAppGuide(lowerMsg);
    }

    // Katalog
    if (/katalog|aktüel|aktuel|kampanya|broşür|brosur/.test(lowerMsg)) {
      return this.handleCatalogQuery();
    }

    // İndirim
    if (/indirim|indirimli|fırsat|firsat|ucuzlayan/.test(lowerMsg)) {
      return this.handleDiscountQuery();
    }

    // Fiyat / ürün
    const priceMatch = this.extractProductFromPriceQuery(lowerMsg);
    if (priceMatch) {
      return this.handlePriceQuery(priceMatch);
    }

    // Sepet optimizasyon ipuçları (genel)
    if (/sepet|tasarruf|optimiz/.test(lowerMsg)) {
      return this.handleCartAdvice(ctx);
    }

    // İhbar nasıl
    if (/ihbar|tarihi geçmiş|tarihi gecmis|son kullanma|expired|bozuk/.test(lowerMsg)) {
      return this.handleReportInfo();
    }

    // Market listesi
    if (/marketler|marketler neler|mağazalar|magazalar|hangi marketler|market zincir/.test(lowerMsg)) {
      return this.handleMarketList();
    }

    // Selam
    if (/^(merhaba|selam|hey|günaydın|gunaydin|iyi günler)(\s|!|$)/.test(lowerMsg) || /nasılsın|nasilsin|naber/.test(lowerMsg)) {
      return this.handleGreeting(ctx);
    }

    // Genel yardım
    if (/yardım|yardim|ne yapabilir|özellik|ozellik|nasıl kullan|nasil kullan/.test(lowerMsg)) {
      return this.handleHelp(ctx);
    }

    const fuzzyProduct = await this.tryFuzzyProductSearch(lowerMsg);
    if (fuzzyProduct) return fuzzyProduct;

    return null;
  }

  private isNearbyIntent(lowerMsg: string): boolean {
    return /en yakın|en yakin|yakınım|yakinim|yakınımda|yakinimda|yakın market|yakin market|bana en yakın|konumuma en|nerede market|hangi market yakın|hangi market yakin|en yakın şube|en yakin sube|yakındaki market|yakindaki market/.test(lowerMsg);
  }

  private isAppHelpIntent(lowerMsg: string): boolean {
    return /barkod|tarama|tara|kamera|nasıl kullan|nasil kullan|uygulama nasıl|uygulama nasil|hangi sekme|nereye bas|fiyat uyarısı kur|fiyat uyarisi kur|optimize et|bildirim ayar/.test(lowerMsg);
  }

  private handleNearbyMarkets(ctx: AssistantContext): string {
    if (!ctx.hasLocation) {
      return [
        '📍 Konumunuzu alamadım.',
        '',
        'Yakın marketleri bulmak için:',
        '1. Telefon ayarlarından Akıllı Sepet için konum iznini açın',
        '2. AI asistan ekranını kapatıp yeniden açın',
        '',
        'Alternatif: Marketler sekmesinden tüm şubelere göz atabilirsiniz.',
      ].join('\n');
    }

    if (ctx.nearbyBranches.length === 0) {
      return 'Konumunuza yakın kayıtlı şube bulunamadı. Marketler sekmesinden şehir bazlı arama yapabilirsiniz.';
    }

    const lines = ctx.nearbyBranches.slice(0, 5).map((b, i) => [
      `${i + 1}. ${b.market} — ${b.name}`,
      `   📍 ${b.address}, ${b.city} (${b.distanceKm.toFixed(1)} km)`,
      b.phone ? `   📞 ${b.phone}` : '',
    ].filter(Boolean).join('\n'));

    const nearest = ctx.nearbyBranches[0];
    return [
      `Konumunuza en yakın market: ${nearest.market} — ${nearest.name} (${nearest.distanceKm.toFixed(1)} km)`,
      '',
      'Diğer yakın şubeler:',
      lines.join('\n'),
      '',
      'Harita ve yol tarifi için Marketler sekmesine gidin.',
    ].join('\n');
  }

  private handleMyCart(ctx: AssistantContext): string {
    if (ctx.cartItemCount === 0) {
      return ctx.isLoggedIn
        ? 'Sepetiniz boş. Ana sayfa veya Ara sekmesinden ürün ekleyebilirsiniz.'
        : 'Sepetiniz boş. Ürün ekledikten sonra buradan sepetinizi sorabilirsiniz. Kalıcı sepet için giriş yapmanızı öneririm.';
    }

    const items = ctx.cartItems.map((i) => `• ${i}`).join('\n');
    return [
      `Sepetinizde ${ctx.cartItemCount} kalem var:`,
      '',
      items,
      '',
      '💡 Sepet sekmesinde "Optimize Et" ile hangi markette toplamda daha ucuz alacağınızı hesaplayabilirsiniz.',
    ].join('\n');
  }

  private handleMyReports(ctx: AssistantContext): string {
    if (!ctx.isLoggedIn) {
      return 'İhbarlarınızı görmek için giriş yapın. Profil → Giriş Yap. Misafir olarak da ihbar oluşturabilirsiniz (Profil veya Ana sayfa → İhbar Et).';
    }
    if (ctx.reportCount === 0) {
      return 'Henüz ihbar göndermemişsiniz. Tarihi geçmiş ürün gördüğünüzde Ana sayfadaki "İhbar Et" ile bildirebilirsiniz.';
    }
    return [
      `Toplam ${ctx.reportCount} ihbarınız var.`,
      ctx.pendingReports > 0
        ? `${ctx.pendingReports} tanesi hâlâ inceleniyor.`
        : 'Tüm ihbarlarınız sonuçlandırılmış görünüyor.',
      '',
      'Detay için Profil → İhbarlarım veya Bildirimler ekranına bakın.',
    ].join('\n');
  }

  private handleMyAlerts(ctx: AssistantContext): string {
    if (!ctx.isLoggedIn) {
      return 'Fiyat uyarısı ve bildirimler için giriş yapmanız gerekir. Ürün detayında "Fiyat uyarısı kur" ile hedef fiyat belirleyebilirsiniz.';
    }
    const parts = [
      `Aktif fiyat uyarınız: ${ctx.priceAlertCount}`,
      `Okunmamış bildirim: ${ctx.unreadNotifications}`,
    ];
    if (ctx.unreadNotifications > 0) {
      parts.push('', 'Bildirimler sekmesinden (Profil → Bildirimler) okuyabilirsiniz.');
    }
    return parts.join('\n');
  }

  private handleAccount(ctx: AssistantContext, lowerMsg: string): string {
    if (ctx.isLoggedIn) {
      return [
        `Merhaba ${ctx.userName ?? 'Kullanıcı'}! 👋`,
        `Hesabınız: ${ctx.userEmail ?? '—'}`,
        '',
        'Profil sekmesinden adınızı güncelleyebilir, ihbarlarınızı ve bildirimlerinizi görebilirsiniz.',
      ].join('\n');
    }
    if (/kayıt|kayit|üye|uye/.test(lowerMsg)) {
      return 'Kayıt olmak için Profil sekmesi → Kayıt Ol. E-posta ve şifre ile birkaç saniyede hesap açabilirsiniz.';
    }
    return 'Giriş yapmak için Profil sekmesi → Giriş Yap. Giriş yapınca sepetiniz, ihbarlarınız ve fiyat uyarılarınız cihazlar arası senkronize olur.';
  }

  private handleAppGuide(lowerMsg: string): string {
    if (/barkod|tara|kamera/.test(lowerMsg)) {
      return 'Barkod taramak için alt menüdeki ortadaki tarama düğmesine veya Ara sekmesindeki barkod ikonuna dokunun. Kamera izni isteyecektir.';
    }
    if (/fiyat uyarı|fiyat uyar/.test(lowerMsg)) {
      return 'Bir ürünün detay sayfasında "Fiyat uyarısı kur" bölümünden hedef fiyat girin. Giriş yapmış olmanız gerekir; fiyat düşünce bildirim alırsınız.';
    }
    if (/optimiz|sepet/.test(lowerMsg)) {
      return 'Sepet sekmesine gidin → "Optimize Et". Uygulama sepetinizdeki ürünler için market market toplam maliyeti hesaplar ve en ucuz seçeneği önerir.';
    }
    return [
      'Akıllı Sepet kısa rehber:',
      '• Ana Sayfa — kampanyalar, kategoriler, ürünler',
      '• Ara — ürün arama ve barkod',
      '• Marketler — şubeler, kataloglar, harita',
      '• Sepet — ürünleriniz ve optimizasyon',
      '• Profil — hesap, ihbarlar, bildirimler',
      '',
      'Bana fiyat, yakın market, sepetiniz veya ihbar hakkında soru sorabilirsiniz.',
    ].join('\n');
  }

  private handleGreeting(ctx: AssistantContext): string {
    const name = ctx.isLoggedIn && ctx.userName ? ` ${ctx.userName}` : '';
    return `Merhaba${name}! Ben Akıllı Sepet. Nasıl yardımcı olabilirim? Fiyat, yakın market, sepet, ihbar veya uygulama hakkında sorabilirsiniz.`;
  }

  private composeContextualFallback(
    message: string,
    lowerMsg: string,
    ctx: AssistantContext,
  ): Promise<string> {
    const hints: string[] = [];

    if (ctx.nearbyBranches.length > 0) {
      const n = ctx.nearbyBranches[0];
      hints.push(`📍 En yakın marketiniz: ${n.market} — ${n.name} (${n.distanceKm.toFixed(1)} km)`);
    }
    if (ctx.cartItemCount > 0) {
      hints.push(`🛒 Sepetinizde ${ctx.cartItemCount} ürün var`);
    }
    if (ctx.isLoggedIn && ctx.pendingReports > 0) {
      hints.push(`⚠️ ${ctx.pendingReports} ihbarınız inceleniyor`);
    }

    return Promise.resolve([
      `"${message}" sorusunu tam yanıtlayamadım ama size yardımcı olabilirim.`,
      '',
      hints.length > 0 ? 'Güncel durumunuz:' : '',
      ...hints,
      hints.length > 0 ? '' : '',
      'Deneyebileceğiniz sorular:',
      '• "Bana en yakın market nerede?"',
      '• "Sepetimde ne var?"',
      '• "En ucuz süt nerede?"',
      '• "İhbar nasıl gönderilir?"',
      '• "Uygulamayı nasıl kullanırım?"',
    ].filter((line, i, arr) => !(line === '' && arr[i + 1] === '')).join('\n'));
  }

  private handleHelp(ctx: AssistantContext): string {
    const base = this.handleHelpStatic();
    if (ctx.nearbyBranches[0]) {
      return `${base}\n\n📍 Şu an en yakınınız: ${ctx.nearbyBranches[0].market} — ${ctx.nearbyBranches[0].name} (${ctx.nearbyBranches[0].distanceKm.toFixed(1)} km)`;
    }
    return base;
  }

  private handleHelpStatic(): string {
    return [
      '🤖 Akıllı Sepet Asistanı — Yapabileceklerim:',
      '',
      '📍 Konum: "Bana en yakın market nerede?"',
      '💰 Fiyat: "En ucuz süt nerede?" / "Makarna fiyatları"',
      '🛒 Sepet: "Sepetimde ne var?" / "Sepetimi optimize et"',
      '📄 Katalog: "Bu haftanın katalogları"',
      '⚠️ İhbar: "İhbar nasıl gönderilir?" / "İhbarlarım"',
      '👤 Hesap: "Profilim" / giriş ve kayıt yönlendirmesi',
      '📱 Uygulama: barkod tarama, bildirimler, sekmeler',
    ].join('\n');
  }

  // =====================================================
  // DOGAL DIL ILE ARAMA (arama ekrani icin)
  // =====================================================
  async naturalLanguageSearch(query: string): Promise<{
    intent: string;
    productName?: string;
    category?: string;
    priceFilter?: string;
    marketName?: string;
    parsedQuery: string;
  }> {
    const lowerQuery = query.toLowerCase();

    // Market adi cikart
    const marketKeywords: Record<string, string> = {
      migros: 'Migros', bim: 'BİM', bİm: 'BİM',
      a101: 'A101', şok: 'ŞOK', sok: 'ŞOK',
      carrefour: 'CarrefourSA', metro: 'Metro',
    };
    const foundMarket = Object.entries(marketKeywords).find(([k]) =>
      lowerQuery.includes(k),
    )?.[1];

    // Fiyat filtresi
    const priceFilter = lowerQuery.includes('ucuz')
      ? 'En ucuz'
      : lowerQuery.includes('pahali')
      ? 'En pahalı'
      : undefined;

    // Kategori tahmini
    const categoryMap: Record<string, string> = {
      süt: 'Süt Ürünleri', peynir: 'Süt Ürünleri', yoğurt: 'Süt Ürünleri',
      et: 'Et & Tavuk', tavuk: 'Et & Tavuk',
      meyve: 'Meyve & Sebze', sebze: 'Meyve & Sebze',
      içecek: 'İçecekler', su: 'İçecekler', cola: 'İçecekler',
      temizlik: 'Temizlik', deterjan: 'Temizlik',
      şampuan: 'Kişisel Bakım', diş: 'Kişisel Bakım',
      dondurulmuş: 'Dondurulmuş',
      atıştır: 'Atıştırmalık', cips: 'Atıştırmalık', çikolata: 'Atıştırmalık',
    };
    const category = Object.entries(categoryMap).find(([k]) =>
      lowerQuery.includes(k),
    )?.[1];

    return {
      intent: foundMarket ? 'market_arama' : category ? 'kategori_arama' : 'urun_arama',
      productName: query,
      category,
      priceFilter,
      marketName: foundMarket,
      parsedQuery: query.trim(),
    };
  }

  // =====================================================
  // FİYAT TAHMİNİ (kural bazli — gecmis veriyle trend)
  // =====================================================
  async predictPriceTrend(
    productId: string,
    marketId: string,
  ): Promise<{
    trend: 'artis' | 'dusus' | 'stabil';
    confidence: number;
    prediction: string;
    recommendation: string;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const priceData = await this.prisma.priceHistory.findMany({
      where: { price: { productId, marketId }, recordedAt: { gte: thirtyDaysAgo } },
      orderBy: { recordedAt: 'asc' },
      select: { amount: true, recordedAt: true },
    });

    if (priceData.length < 2) {
      return {
        trend: 'stabil',
        confidence: 0.3,
        prediction: 'Yeterli fiyat geçmişi yok, trend hesaplanamadı.',
        recommendation: 'Fiyatı takip etmeye devam edin.',
      };
    }

    return this.simpleTrendAnalysis(priceData);
  }

  // =====================================================
  // KİŞİSELLEŞTİRİLMİŞ ÖNERİLER
  // =====================================================
  async generateRecommendations(userId: string): Promise<{
    recommendations: Array<{ type: string; title: string; description: string; productIds?: string[] }>;
  }> {
    const recentItems = await this.prisma.cartItem.findMany({
      where: { cart: { userId } },
      include: { product: { select: { id: true, name: true, categoryId: true } } },
      orderBy: { addedAt: 'desc' },
      take: 10,
    });

    if (recentItems.length === 0) {
      // Genel populer oneri
      const cheapest = await this.prisma.price.findMany({
        where: { isAvailable: true },
        orderBy: { amount: 'asc' },
        take: 3,
        include: { product: { select: { id: true, name: true } }, market: { select: { name: true } } },
      });

      return {
        recommendations: [
          {
            type: 'POPULAR',
            title: 'Bu Hafta Dikkat Çeken Fiyatlar',
            description: cheapest
              .map((p) => `${p.product.name}: ${formatTL(p.amount)} (${p.market.name})`)
              .join(' • '),
            productIds: cheapest.map((p) => p.productId),
          },
        ],
      };
    }

    const userProductIds = recentItems.map((i) => i.productId);

    // Sepet birlikteligi — ayni sepette sik alinan urunler
    const coItems = await this.prisma.cartItem.findMany({
      where: {
        cart: { items: { some: { productId: { in: userProductIds } } } },
        productId: { notIn: userProductIds },
      },
      select: { productId: true, product: { select: { id: true, name: true } } },
      take: 150,
    });

    const coCounts = new Map<string, { id: string; name: string; count: number }>();
    coItems.forEach((item) => {
      const prev = coCounts.get(item.productId);
      if (prev) prev.count++;
      else coCounts.set(item.productId, { ...item.product, count: 1 });
    });

    const coPurchased = [...coCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recommendations: Array<{
      type: string;
      title: string;
      description: string;
      productIds?: string[];
    }> = [];

    if (coPurchased.length > 0) {
      recommendations.push({
        type: 'CO_PURCHASE',
        title: 'Birlikte Alınan Ürünler',
        description: `Sepetinizdekilere göre: ${coPurchased.map((p) => p.name).join(', ')}`,
        productIds: coPurchased.map((p) => p.id),
      });
    }

    // Kategori bazli oneri
    const categories = [...new Set(recentItems.map((i) => i.product.categoryId))];
    const suggestions = await this.prisma.product.findMany({
      where: {
        categoryId: { in: categories },
        id: { notIn: userProductIds },
        isActive: true,
      },
      take: 5,
      select: { id: true, name: true },
    });

    recommendations.push({
      type: 'PERSONALIZED',
      title: 'Alışveriş Geçmişinize Göre',
      description: suggestions.length
        ? `Şunları da beğenebilirsiniz: ${suggestions.map((s) => s.name).join(', ')}`
        : 'Daha fazla ürün keşfedin!',
      productIds: suggestions.map((s) => s.id),
    });

    return { recommendations };
  }

  // =====================================================
  // KURAL MOTORU — Yardimci metodlar
  // =====================================================

  private extractProductFromPriceQuery(msg: string): string | null {
    if (/^(merhaba|selam|hey|naber|nasılsın|nasilsin|kimsin|tanıt|tanit|kendini|who are you)/.test(msg.trim())) {
      return null;
    }

    const cleaned = msg
      .replace(/[?.!,]/g, ' ')
      .replace(/\b(?:nerede|nasıl|nasil|ne zaman|var mı|var mi|varmı|kaç para|kaça|ne kadar|için|icin|uygun|hangi market|en uygun|lazım|lazim|almak|istiyorum)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /(?:en ucuz|ucuz olan|ucuz)\s+(.+)/i,
      /(.+?)\s+(?:fiyat[ıi]?|fiyatlari|fiyatları|kaça|ne kadar)/i,
      /(.+?)\s+karsilastir/i,
      /(.+?)\s+karşılaştır/i,
      /(.+?)\s+en ucuz/i,
      /(?:^|\s)(.+?)\s+(?:neler?|var|bul|satılıyor|satiliyor)/i,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match?.[1]) {
        const term = match[1].trim();
        if (term.length > 1 && !this.isStopWord(term)) return term;
      }
    }

    // "makarna", "süt" gibi tek/çift kelimelik doğrudan ürün adı
    const words = cleaned.split(' ').filter((w) => w.length > 2 && !this.isStopWord(w));
    if (words.length >= 1 && words.length <= 3) {
      return words.join(' ');
    }

    return null;
  }

  private isStopWord(word: string): boolean {
    const stops = new Set([
      'bu', 'şu', 'su', 'bir', 'the', 've', 'ile', 'mi', 'mı', 'mu', 'mü',
      'hafta', 'bugün', 'bugun', 'şimdi', 'simdi', 'lütfen', 'lutfen',
      'asistan', 'sepet', 'market', 'ürün', 'urun', 'fiyat', 'katalog',
      'merhaba', 'selam', 'kendini', 'tanit', 'tanıt', 'nasilsin', 'nasılsın',
    ]);
    return stops.has(word.toLowerCase());
  }

  private async tryFuzzyProductSearch(lowerMsg: string): Promise<string | null> {
    const tokens = lowerMsg
      .replace(/[?.!,]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.isStopWord(w));

    for (const token of tokens) {
      const expanded = this.expandTRQuery(token);
      for (const term of expanded) {
        const count = await this.prisma.product.count({
          where: {
            isActive: true,
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { brand: { contains: term, mode: 'insensitive' } },
            ],
          },
        });
        if (count > 0) {
          return this.handlePriceQuery(term);
        }
      }
    }
    return null;
  }

  // Turkce karakter normalizasyonu (turkce -> latin) — DB sorgusu icin
  private normalizeTR(text: string): string {
    return text
      .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ı/g, 'i')
      .replace(/İ/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
      .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c');
  }

  // Yaygın Turkce kelime eslesmeleri — kullanici latin yazar, DB'de Turkce var
  private readonly TR_WORD_MAP: Record<string, string> = {
    sut: 'süt', peynir: 'peynir', yogurt: 'yoğurt',
    koy: 'köy', kofte: 'köfte', seker: 'şeker', sehriye: 'şehriye',
    cokelat: 'çikolata', cikolata: 'çikolata', cay: 'çay', elma: 'elma',
    domates: 'domates', patates: 'patates', makarna: 'makarna', pirinc: 'pirinç',
    zeytinyagi: 'zeytinyağı', aycicek: 'ayçiçek', un: 'un', tuz: 'tuz',
    deterjan: 'deterjan', sampuan: 'şampuan', sabun: 'sabun',
    su: 'su', kola: 'cola', portakal: 'portakal',
  };

  private expandTRQuery(query: string): string[] {
    // Orjinal + Turkce karakterli versiyonu dondur
    const words = query.split(/\s+/);
    const expanded = words
      .map((w) => this.TR_WORD_MAP[this.normalizeTR(w).toLowerCase()] || w)
      .join(' ');
    return query === expanded ? [query] : [query, expanded];
  }

  private async handlePriceQuery(productName: string): Promise<string> {
    const searchTerms = [...this.expandTRQuery(productName), this.normalizeTR(productName)];

    type PriceRow = { amount: number; productId: string; marketId: string; product: { name: string }; market: { name: string } };
    let prices: PriceRow[] = [];

    for (const term of searchTerms) {
      const result = await this.prisma.price.findMany({
        where: {
          isAvailable: true,
          product: { name: { contains: term, mode: 'insensitive' }, isActive: true },
        },
        select: {
          amount: true,
          productId: true,
          marketId: true,
          product: { select: { name: true } },
          market: { select: { name: true } },
        },
        orderBy: { amount: 'asc' },
        take: 10,
      });
      if (result.length > 0) { prices = result; break; }
    }

    if (prices.length === 0) {
      return `"${productName}" için fiyat bulunamadı. Arama kutusundan ürünü aratabilir veya barkod okuyucuyla tarayabilirsiniz.`;
    }

    const grouped = new Map<string, number[]>();
    for (const p of prices) {
      const key = `${p.product.name} @ ${p.market.name}`;
      grouped.set(key, [...(grouped.get(key) || []), p.amount]);
    }

    const lines = [...grouped.entries()].map(([key, amounts]) => {
      return `• ${key}: ${formatTL(Math.min(...amounts))}`;
    });

    const cheapest = prices[0];
    return [
      `🔍 "${productName}" için fiyatlar:`,
      ...lines,
      '',
      `✅ En uygun: ${cheapest.market.name} → ${formatTL(cheapest.amount)}`,
    ].join('\n');
  }

  private async handleDiscountQuery(): Promise<string> {
    const discounted = await this.prisma.price.findMany({
      where: {
        isAvailable: true,
        discountedAmount: { not: null },
      },
      include: {
        product: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: { amount: 'asc' },
      take: 8,
    });

    if (discounted.length > 0) {
      const lines = discounted.map((p) => {
        const old = p.discountedAmount ?? p.amount;
        const saving = old > p.amount ? Math.round(((old - p.amount) / old) * 100) : 0;
        return `• ${p.product.name} @ ${p.market.name}: ${formatTL(p.amount)}${saving > 0 ? ` (%${saving} indirim)` : ''}`;
      });
      return ['🏷️ İndirimli ürünler:', ...lines].join('\n');
    }

    // İndirimli fiyat kaydı yoksa en ucuz ürünleri öner
    const cheapest = await this.prisma.price.findMany({
      where: { isAvailable: true },
      include: {
        product: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: { amount: 'asc' },
      take: 6,
    });

    if (cheapest.length === 0) {
      return 'Şu an indirim veya fiyat verisi bulunamadı. Kataloglar sekmesine göz atabilirsiniz.';
    }

    const lines = cheapest.map(
      (p) => `• ${p.product.name} @ ${p.market.name}: ${formatTL(p.amount)}`,
    );
    return [
      'Özel indirim kaydı yok; bu hafta dikkat çeken uygun fiyatlar:',
      ...lines,
      '',
      'Güncel kampanyalar için Kataloglar sekmesini de kontrol edin.',
    ].join('\n');
  }

  private async handleCatalogQuery(): Promise<string> {
    const catalogs = await this.prisma.catalog.findMany({
      where: { isActive: true, endDate: { gte: new Date() } },
      include: { market: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
      take: 5,
    });

    if (catalogs.length === 0) {
      return 'Şu an aktif katalog bulunmuyor. Yakında yeni kataloglar eklenecek!';
    }

    const lines = catalogs.map(
      (c) => `📄 ${c.market.name}: "${c.title}" (${c.endDate.toLocaleDateString('tr-TR')}\'e kadar)`,
    );

    return ['Bu hafta geçerli kataloglar:', ...lines, '', 'Detaylar için Kataloglar sekmesini ziyaret edin.'].join('\n');
  }

  private handleCartAdvice(ctx?: AssistantContext): string {
    const cartLine = ctx && ctx.cartItemCount > 0
      ? `\nSepetinizde şu an ${ctx.cartItemCount} ürün var — Optimize Et ile hemen karşılaştırabilirsiniz.`
      : '';
    return [
      '🛒 Sepet Optimizasyonu:',
      '',
      '1. Sepet sekmesine gidin',
      '2. "Optimize Et" düğmesine basın',
      '3. Uygulama her market için toplam tutarı hesaplar',
      '',
      '💡 BİM ve A101 temel gıdada, Migros kart kampanyalarında öne çıkabilir.',
      cartLine,
    ].filter(Boolean).join('\n');
  }

  private handleReportInfo(): string {
    return [
      '⚠️ Tarihi Geçmiş Ürün Bildirimi:',
      '',
      'Markette son kullanma tarihi geçmiş ürün gördüyseniz:',
      '1. "İhbar Et" düğmesine veya barkod okuyucuya gidin.',
      '2. Ürünü tarayın veya açıklama yazın.',
      '3. Fotoğraf ve konum ekleyin (opsiyonel ama çok faydalı).',
      '4. Gönderin — yetkililer kısa sürede inceleyecek.',
      '',
      'Anonim olarak da bildirim yapabilirsiniz.',
    ].join('\n');
  }

  private async handleMarketList(): Promise<string> {
    const markets = await this.prisma.market.findMany({
      where: { isActive: true },
      select: { name: true, website: true },
    });

    if (markets.length === 0) return 'Henüz market eklenmemiş.';

    const lines = markets.map((m) => `• ${m.name}${m.website ? ` (${m.website})` : ''}`);
    return ['Sistemdeki marketler:', ...lines].join('\n');
  }

  // ---- Yardimci: Basit trend analizi ----
  private simpleTrendAnalysis(priceData: Array<{ amount: number; recordedAt: Date }>) {
    const amounts = priceData.map((p) => p.amount);
    const mid = Math.floor(amounts.length / 2);
    const firstAvg = amounts.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondAvg = amounts.slice(mid).reduce((a, b) => a + b, 0) / (amounts.length - mid);
    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (diff > 5) {
      return {
        trend: 'artis' as const,
        confidence: 0.65,
        prediction: `Son 30 günde %${diff.toFixed(1)} fiyat artışı gözlemlendi.`,
        recommendation: 'Şimdi almak daha avantajlı olabilir.',
      };
    } else if (diff < -5) {
      return {
        trend: 'dusus' as const,
        confidence: 0.65,
        prediction: `Son 30 günde %${Math.abs(diff).toFixed(1)} fiyat düşüşü gözlemlendi.`,
        recommendation: 'Fiyat düşüşü devam edebilir, biraz bekleyebilirsiniz.',
      };
    }

    return {
      trend: 'stabil' as const,
      confidence: 0.75,
      prediction: 'Fiyat son 30 günde stabil seyretti.',
      recommendation: 'İhtiyacınıza göre alabilirsiniz.',
    };
  }
}
