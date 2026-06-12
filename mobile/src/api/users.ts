import api from './client';
import { User } from '../types/api';

export interface UpdateProfileData {
  name?: string;
  surname?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ReputationProfile {
  score: number;
  level: string;
  levelIcon: string;
  levelColor: string;
  levelPerk: string;
  trustWeight: number;
  nextLevel: string | null;
  nextLevelAt: number | null;
  progressPercent: number;
  stats: {
    verifications: number;
    submissions: number;
    approved: number;
    rejected: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    points: number;
    scoreAfter: number;
    title: string;
    description?: string | null;
    createdAt: string;
  }>;
  engagementTips: string[];
}

export const updateProfile = (data: UpdateProfileData) =>
  api.patch<{ data: User }>('/users/me', data).then((r) => r.data.data);

export const getMyProfile = () =>
  api.get<{ data: User }>('/users/me').then((r) => r.data.data);

export const getMyReputation = () =>
  api.get<{ data: ReputationProfile }>('/users/me/reputation').then((r) => r.data.data);
