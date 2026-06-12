// =====================================================
// Akıllı Sepet - API Tip Tanimlari
// Backend modelleriyle eslesen TypeScript tipleri
// =====================================================

// ---- Genel Yanitlar ----
export interface ApiResponse<T> {
  data: T;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

// ---- Kullanici ----
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSPECTOR' | 'MARKET_MANAGER' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  bannedUntil?: string | null;
  banReason?: string | null;
  isPermanentBan?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ---- Kategori ----
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string;
  children?: Category[];
  productCount?: number;
  _count?: { products: number };
}

// ---- Urun ----
export interface Product {
  id: string;
  name: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  unit?: string;
  unitValue?: number;
  slug?: string;
  categoryId: string;
  category?: Category & { parent?: Pick<Category, 'id' | 'name' | 'icon'> };
  barcodes?: Barcode[];
  prices?: Price[];
  lowestPrice?: number;     // Kurus cinsinden
  lowestPriceMarket?: Pick<Market, 'id' | 'name' | 'brandColor'> | null;
}

export interface Barcode {
  id: string;
  code: string;
  format: string;
}

// ---- Market ----
export interface Market {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
  description?: string;
  website?: string;
  isActive: boolean;
  _count?: { branches: number; catalogs: number };
  branches?: MarketBranch[];
  catalogs?: Catalog[];
}

export interface MarketBranch {
  id: string;
  marketId: string;
  market?: Pick<Market, 'id' | 'name' | 'logoUrl' | 'brandColor'>;
  name: string;
  address: string;
  city: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  workingHours?: string;
  isActive: boolean;
  distanceKm?: number; // Yakin sube aramasinda doluyor
}

// ---- Fiyat ----
export interface Price {
  id: string;
  productId: string;
  marketId: string;
  market?: Pick<Market, 'id' | 'name' | 'logoUrl' | 'brandColor' | 'slug'>;
  amount: number;         // Kurus
  isAvailable: boolean;
  source?: string;
  needsVerification?: boolean;
  freshness?: 'fresh' | 'aging' | 'stale' | 'unknown';
  lastUpdated: string;
}

export interface PriceHistory {
  id: string;
  amount: number;
  recordedAt: string;
}

// ---- Sepet ----
export interface CartItem {
  id: string;
  quantity: number;
  addedAt: string;
  unitPrice: number | null;
  market: Pick<Market, 'id' | 'name' | 'logoUrl' | 'brandColor'>;
  product: Pick<Product, 'id' | 'name' | 'brand' | 'imageUrl' | 'unit' | 'unitValue'>;
}

export interface MarketCartGroup {
  marketId: string;
  marketName: string;
  marketLogoUrl?: string | null;
  marketBrandColor?: string | null;
  itemCount: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  userId?: string;
  sessionId?: string;
  items: CartItem[];
  totalItems: number;
  totalCost: number;
  marketGroups: MarketCartGroup[];
}

export interface MarketCartResult {
  marketId: string;
  marketName: string;
  marketLogoUrl?: string | null;
  marketBrandColor?: string | null;
  totalCost: number;
  foundItems: number;
  totalItems: number;
  coverageRate: number;
  missingProducts: string[];
  savings: number;
}

export interface CartItemSuggestion {
  itemId: string;
  productName: string;
  currentMarketName: string;
  currentPrice: number;
  suggestedMarketName: string;
  suggestedPrice: number;
  savings: number;
}

export interface CartOptimizationResult {
  cart: Cart;
  chosenTotalCost: number;
  marketGroups: MarketCartGroup[];
  singleMarketOptions: MarketCartResult[];
  potentialSavings: number;
  itemSuggestions: CartItemSuggestion[];
}

// ---- Katalog ----
export interface CatalogPage {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl?: string;
}

export interface Catalog {
  id: string;
  marketId: string;
  market?: Pick<Market, 'id' | 'name' | 'slug' | 'logoUrl' | 'brandColor'>;
  title: string;
  description?: string;
  coverImageUrl?: string;
  pdfUrl?: string;
  sourceUrl?: string;
  scrapeSource?: string;
  startDate: string;
  endDate: string;
  pageCount: number;
  isActive: boolean;
  pages?: CatalogPage[];
  _count?: { pages: number };
}

// ---- Ihbar (Report) ----
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface ReportImage {
  id: string;
  url: string;
}

export interface Report {
  id: string;
  userId?: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  productId?: string;
  product?: Pick<Product, 'id' | 'name'>;
  marketId?: string;
  market?: Pick<Market, 'id' | 'name' | 'logoUrl'>;
  barcodeCode?: string;
  description: string;
  expiryDate?: string;
  status: ReportStatus;
  userNote?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  district?: string;
  isAnonymous: boolean;
  images: ReportImage[];
  createdAt: string;
}

// ---- Bildirim ----
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, string>;
}
