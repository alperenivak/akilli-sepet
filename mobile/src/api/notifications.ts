import api from './client';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'PRICE_DROP' | 'PRICE_ALERT' | 'REPORT_STATUS' | 'NEW_CATALOG' | 'AI_RECOMMENDATION' | 'SYSTEM';
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export const getMyNotifications = async (page = 1, limit = 30): Promise<NotificationsResponse> => {
  const { data } = await api.get('/notifications', { params: { page, limit } });
  return data.data ?? data;
};

export const markNotificationsRead = async (notificationIds?: string[]): Promise<void> => {
  await api.patch('/notifications/read', { notificationIds });
};
