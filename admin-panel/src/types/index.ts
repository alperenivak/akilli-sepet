// Admin panel tip tanimlari - backend modelleriyle eslesen

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'INSPECTOR' | 'MARKET_MANAGER' | 'USER';
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface ManagedMarket {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  managedMarket?: ManagedMarket | null;
  bannedUntil?: string | null;
  banReason?: string | null;
  isPermanentBan?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  workingHours?: string;
  isActive: boolean;
  marketId: string;
}

export interface Market {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
  website?: string;
  isActive: boolean;
  _count?: { branches: number; catalogs: number };
  branches?: Branch[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string;
  children?: Category[];
  productCount?: number;
  _count?: { products: number };
  parent?: Pick<Category, 'id' | 'name' | 'slug' | 'icon'>;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  unit?: string;
  unitValue?: number;
  categoryId: string;
  category?: Category;
  isActive: boolean;
  createdAt: string;
  barcodes?: Array<{ id: string; code: string; format: string }>;
}

export interface Report {
  id: string;
  description: string;
  status: ReportStatus;
  userNote?: string;
  marketNote?: string;
  city?: string;
  district?: string;
  expiryDate?: string;
  isAnonymous: boolean;
  createdAt: string;
  marketNameOther?: string;
  pushedToMarketAt?: string;
  pushedBy?: Pick<User, 'id' | 'name' | 'surname'>;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  product?: { id: string; name: string };
  market?: Pick<Market, 'id' | 'name' | 'logoUrl'>;
  branch?: Pick<Branch, 'id' | 'name' | 'address' | 'city'>;
  images?: Array<{ id: string; url: string }>;
}

export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalMarkets: number;
  totalPrices: number;
  totalReports: number;
  pendingReports: number;
  activeCatalogs: number;
  priceUpdatesToday: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface DayTrend { date: string; count: number }

export interface AdminStatistics {
  scope: 'admin';
  generatedAt: string;
  overview: {
    totalUsers: number;
    activeProducts: number;
    totalProducts: number;
    totalMarkets: number;
    totalBranches: number;
    totalPrices: number;
    stalePrices: number;
    activeCatalogs: number;
    totalInspectors: number;
    totalMarketManagers: number;
    priceUpdates24h: number;
  };
  users: { byRole: { role: string; count: number }[]; newLast30Days: number };
  reports: {
    total: number; pending: number; underReview: number;
    approved: number; rejected: number; resolved: number;
    last7DaysTrend: DayTrend[];
    topMarkets: Array<{ marketId: string | null; count: number; market: { id: string; name: string; brandColor?: string } | null }>;
    topCategories: Array<{ category: { id: string; name: string; icon?: string }; count: number }>;
    pushedToMarket: number;
  };
  prices: {
    total: number; stale: number; updatesLast24h: number;
    last7DaysTrend: DayTrend[];
    marketCoverage: Array<{ marketId: string; name: string; brandColor?: string; pricedCount: number; coveragePercent: number }>;
  };
  inspectors: {
    active: number;
    leaderboard: Array<{ inspectorId: string | null; reviewedCount: number; name: string }>;
  };
}

export interface InspectorStatistics {
  scope: 'inspector';
  generatedAt: string;
  queue: { total: number; pending: number; underReview: number; approved: number; rejected: number; resolved: number };
  myPerformance: {
    reviewedToday: number; reviewedThisWeek: number; totalReviewed: number;
    approved: number; rejected: number; underReview: number;
    pushedToMarket: number; approvalRate: number;
  };
  insights: {
    withPhotos: number; urgentExpiry: number;
    topMarkets: AdminStatistics['reports']['topMarkets'];
    categoryBreakdown: AdminStatistics['reports']['topCategories'];
    last7DaysTrend: DayTrend[];
  };
}

export interface MarketStatistics {
  scope: 'market';
  generatedAt: string;
  market: { id: string; name: string; brandColor?: string; slug: string };
  products: {
    totalInCatalog: number; withPrice: number; missingPrice: number;
    coveragePercent: number; stalePrices: number;
    priceUpdatesThisWeek: number; avgPriceKurus: number;
  };
  operations: { branches: number; activeCatalogs: number };
  reports: {
    total: number; pending: number; underReview: number;
    approved: number; rejected: number; resolved: number;
    pushedToMarket: number; last7DaysTrend: DayTrend[];
    topProducts: Array<{ productId: string | null; count: number; product: { id: string; name: string; brand?: string } | null }>;
  };
  categoryPricing: Array<{ category: { id: string; name: string; icon?: string }; count: number }>;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
