// =====================================================
// Akıllı Sepet - Sepet Servisi
// Sepet CRUD + Market bazli fiyat optimizasyonu
// Her sepet kalemi belirli bir marketten eklenir
// =====================================================

import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Sepet optimizasyonunda kullanilacak minimum guven skoru
// Bu degerden dusuk confidence'li fiyatlar (seed data) hesaba katilmaz
const MIN_CONFIDENCE_FOR_CART = 0.3;

export interface MarketCartResult {
  marketId: string;
  marketName: string;
  marketLogoUrl: string | null;
  marketBrandColor: string | null;
  totalCost: number;
  foundItems: number;
  totalItems: number;
  coverageRate: number;
  missingProducts: string[];
  savings: number;
}

export interface MarketCartGroup {
  marketId: string;
  marketName: string;
  marketLogoUrl: string | null;
  marketBrandColor: string | null;
  itemCount: number;
  subtotal: number;
}

export interface CartItemSuggestion {
  itemId: string;
  productName: string;
  currentMarketName: string;
  currentPrice: number;
  suggestedMarketName: string;
  suggestedPrice: number;
  savings: number;
  suggestedPriceSource: string;
  suggestedConfidenceScore: number;
}

export interface CartSummary {
  id: string;
  userId: string | null;
  sessionId: string | null;
  items: Array<{
    id: string;
    quantity: number;
    addedAt: Date;
    unitPrice: number | null;
    market: {
      id: string;
      name: string;
      logoUrl: string | null;
      brandColor: string | null;
    };
    product: {
      id: string; name: string; brand: string | null;
      imageUrl: string | null; unit: string | null; unitValue: number | null;
    };
  }>;
  totalItems: number;
  totalCost: number;
  marketGroups: MarketCartGroup[];
}

export interface CartOptimizationResult {
  cart: CartSummary;
  chosenTotalCost: number;
  marketGroups: MarketCartGroup[];
  singleMarketOptions: MarketCartResult[];
  potentialSavings: number;
  itemSuggestions: CartItemSuggestion[];
}

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCart(userId?: string, sessionId?: string): Promise<CartSummary> {
    if (!userId && !sessionId) {
      throw new BadRequestException('Kullanici ID veya session ID gerekli');
    }

    const where = userId ? { userId } : { sessionId };

    let cart = await this.prisma.cart.findFirst({
      where,
      include: this.cartInclude(),
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: where,
        include: this.cartInclude(),
      });
    }

    return this.enrichCart(cart);
  }

  async addItem(
    dto: AddCartItemDto,
    userId?: string,
    sessionId?: string,
  ): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isActive: true },
    });
    if (!product) throw new NotFoundException('Urun bulunamadi veya aktif degil');

    const market = await this.prisma.market.findFirst({
      where: { id: dto.marketId, isActive: true },
    });
    if (!market) throw new NotFoundException('Market bulunamadi veya aktif degil');

    const price = await this.prisma.price.findFirst({
      where: {
        productId: dto.productId,
        marketId: dto.marketId,
        isAvailable: true,
      },
    });
    if (!price) {
      throw new BadRequestException('Bu urun secilen markette satista degil');
    }

    const quantity = dto.quantity ?? 1;

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: dto.productId, marketId: dto.marketId },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          unitPrice: price.amount,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          marketId: dto.marketId,
          quantity,
          unitPrice: price.amount,
        },
      });
    }

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItem(
    itemId: string,
    dto: UpdateCartItemDto,
    userId?: string,
    sessionId?: string,
  ): Promise<CartSummary> {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Sepet ogesi bulunamadi');

    if (dto.quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
      });
    }

    return this.getOrCreateCart(userId, sessionId);
  }

  async removeItem(
    itemId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<CartSummary> {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Sepet ogesi bulunamadi');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getOrCreateCart(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string): Promise<{ message: string }> {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { message: 'Sepet bosaltildi' };
  }

  async optimizeCart(
    userId?: string,
    sessionId?: string,
  ): Promise<CartOptimizationResult> {
    const cart = await this.getOrCreateCart(userId, sessionId);

    if (cart.items.length === 0) {
      return {
        cart,
        chosenTotalCost: 0,
        marketGroups: [],
        singleMarketOptions: [],
        potentialSavings: 0,
        itemSuggestions: [],
      };
    }

    const productIds = cart.items.map((item) => item.product.id);
    const allPrices = await this.loadPricesForCart(productIds);
    const priceMap = this.buildPriceMap(allPrices);
    const marketMap = this.buildMarketMap(allPrices);

    const itemSuggestions = this.buildItemSuggestions(cart.items, priceMap);
    const singleMarketOptions = this.rankMarkets(marketMap, cart.items);
    const bestSingle = singleMarketOptions[0];
    const potentialSavings = bestSingle
      ? Math.max(0, cart.totalCost - bestSingle.totalCost)
      : 0;

    return {
      cart,
      chosenTotalCost: cart.totalCost,
      marketGroups: cart.marketGroups,
      singleMarketOptions,
      potentialSavings,
      itemSuggestions,
    };
  }

  async mergeCarts(sessionId: string, userId: string): Promise<CartSummary> {
    if (!sessionId) return this.getOrCreateCart(userId);

    const [sessionCart, userCart] = await Promise.all([
      this.prisma.cart.findFirst({
        where: { sessionId },
        include: { items: true },
      }),
      this.prisma.cart.findFirst({ where: { userId } }),
    ]);

    if (!sessionCart || sessionCart.items.length === 0) {
      return this.getOrCreateCart(userId);
    }

    if (!userCart) {
      await this.prisma.cart.update({
        where: { id: sessionCart.id },
        data: { userId, sessionId: null },
      });
      return this.getOrCreateCart(userId);
    }

    const existingItems = await this.prisma.cartItem.findMany({
      where: {
        cartId: userCart.id,
        OR: sessionCart.items.map((i) => ({
          productId: i.productId,
          marketId: i.marketId,
        })),
      },
    });
    const existingMap = new Map(
      existingItems.map((i) => [`${i.productId}:${i.marketId}`, i]),
    );

    await Promise.all(
      sessionCart.items.map((item) => {
        const key = `${item.productId}:${item.marketId}`;
        const existing = existingMap.get(key);
        if (existing) {
          return this.prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          });
        }
        return this.prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: item.productId,
            marketId: item.marketId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
        });
      }),
    );

    await this.prisma.cartItem.deleteMany({ where: { cartId: sessionCart.id } });
    await this.prisma.cart.delete({ where: { id: sessionCart.id } });

    return this.getOrCreateCart(userId);
  }

  private async loadPricesForCart(productIds: string[]) {
    // Yalnizca yeterli guven skoruna sahip fiyatlari getir
    // Seed data (confidenceScore=0.2) dahil edilmez — sadece dogrulanmis veya yeterli crowdsource
    return this.prisma.price.findMany({
      where: {
        productId: { in: productIds },
        isAvailable: true,
        confidenceScore: { gte: MIN_CONFIDENCE_FOR_CART },
      },
      include: {
        market: { select: { id: true, name: true, logoUrl: true, brandColor: true } },
      },
    });
  }

  private buildPriceMap(allPrices: Array<{
    marketId: string;
    productId: string;
    amount: number;
    source: string;
    confidenceScore: number;
    market: { id: string; name: string; logoUrl: string | null; brandColor: string | null };
  }>) {
    const map = new Map<string, Array<{
      marketId: string;
      amount: number;
      marketName: string;
      source: string;
      confidenceScore: number;
    }>>();
    for (const price of allPrices) {
      if (!map.has(price.productId)) map.set(price.productId, []);
      map.get(price.productId)!.push({
        marketId: price.marketId,
        amount: price.amount,
        marketName: price.market.name,
        source: price.source,
        confidenceScore: price.confidenceScore,
      });
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.amount - b.amount);
    }
    return map;
  }

  private buildMarketMap(allPrices: Array<{
    marketId: string;
    productId: string;
    amount: number;
    market: { id: string; name: string; logoUrl: string | null; brandColor: string | null };
  }>) {
    const marketMap = new Map<string, {
      market: { id: string; name: string; logoUrl: string | null; brandColor: string | null };
      prices: Map<string, number>;
    }>();

    for (const price of allPrices) {
      if (!marketMap.has(price.marketId)) {
        marketMap.set(price.marketId, { market: price.market, prices: new Map() });
      }
      marketMap.get(price.marketId)!.prices.set(price.productId, price.amount);
    }

    return marketMap;
  }

  private buildItemSuggestions(
    items: CartSummary['items'],
    priceMap: ReturnType<typeof this.buildPriceMap>,
  ): CartItemSuggestion[] {
    const suggestions: CartItemSuggestion[] = [];

    for (const item of items) {
      const prices = priceMap.get(item.product.id) ?? [];
      const cheapest = prices[0];
      if (!cheapest || cheapest.marketId === item.market.id) continue;

      const currentPrice = item.unitPrice ?? cheapest.amount;
      const savings = (currentPrice - cheapest.amount) * item.quantity;
      if (savings <= 0) continue;

      suggestions.push({
        itemId: item.id,
        productName: item.product.name,
        currentMarketName: item.market.name,
        currentPrice,
        suggestedMarketName: cheapest.marketName,
        suggestedPrice: cheapest.amount,
        savings,
        suggestedPriceSource: cheapest.source,
        suggestedConfidenceScore: cheapest.confidenceScore,
      });
    }

    return suggestions.sort((a, b) => b.savings - a.savings);
  }

  private rankMarkets(
    marketMap: ReturnType<typeof this.buildMarketMap>,
    items: CartSummary['items'],
  ): MarketCartResult[] {
    const results: MarketCartResult[] = [];

    for (const [marketId, { market, prices }] of marketMap) {
      let totalCost = 0;
      let foundItems = 0;
      const missingProducts: string[] = [];

      for (const item of items) {
        const unitPrice = prices.get(item.product.id);
        if (unitPrice !== undefined) {
          totalCost += unitPrice * item.quantity;
          foundItems++;
        } else {
          missingProducts.push(item.product.name);
        }
      }

      results.push({
        marketId,
        marketName: market.name,
        marketLogoUrl: market.logoUrl,
        marketBrandColor: market.brandColor,
        totalCost,
        foundItems,
        totalItems: items.length,
        coverageRate: foundItems / items.length,
        missingProducts,
        savings: 0,
      });
    }

    results.sort((a, b) => {
      if (a.coverageRate !== b.coverageRate) return b.coverageRate - a.coverageRate;
      return a.totalCost - b.totalCost;
    });

    if (results.length > 1) {
      const mostExpensive = Math.max(...results.map((r) => r.totalCost));
      results.forEach((r) => { r.savings = mostExpensive - r.totalCost; });
    }

    return results;
  }

  private buildMarketGroups(
    items: CartSummary['items'],
  ): MarketCartGroup[] {
    const groups = new Map<string, MarketCartGroup>();

    for (const item of items) {
      const lineTotal = (item.unitPrice ?? 0) * item.quantity;
      const existing = groups.get(item.market.id);
      if (existing) {
        existing.itemCount += item.quantity;
        existing.subtotal += lineTotal;
      } else {
        groups.set(item.market.id, {
          marketId: item.market.id,
          marketName: item.market.name,
          marketLogoUrl: item.market.logoUrl,
          marketBrandColor: item.market.brandColor,
          itemCount: item.quantity,
          subtotal: lineTotal,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.subtotal - a.subtotal);
  }

  private cartInclude() {
    return {
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, brand: true,
              imageUrl: true, unit: true, unitValue: true,
            },
          },
          market: {
            select: {
              id: true, name: true, logoUrl: true, brandColor: true,
            },
          },
        },
        orderBy: [{ marketId: 'asc' as const }, { addedAt: 'desc' as const }],
      },
    };
  }

  private enrichCart(cart: {
    id: string;
    userId: string | null;
    sessionId: string | null;
    items: Array<{
      id: string;
      quantity: number;
      addedAt: Date;
      unitPrice: number | null;
      market: {
        id: string;
        name: string;
        logoUrl: string | null;
        brandColor: string | null;
      };
      product: {
        id: string; name: string; brand: string | null;
        imageUrl: string | null; unit: string | null; unitValue: number | null;
      };
    }>;
  }): CartSummary {
    const totalCost = cart.items.reduce(
      (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
      0,
    );

    return {
      ...cart,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalCost,
      marketGroups: this.buildMarketGroups(cart.items),
    };
  }
}
