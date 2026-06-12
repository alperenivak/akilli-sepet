import api from './client';

export type RewardStatus = 'LOCKED' | 'CLAIMABLE' | 'CLAIMED' | 'DEPLETED';
export type RewardCodeMode = 'MANUAL' | 'AUTO' | 'HYBRID';

export interface CommunityRewardItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  benefitText: string;
  discountLabel: string;
  minReputation: number;
  levelLabel: string;
  levelIcon: string;
  instructions?: string | null;
  codeMode?: RewardCodeMode;
  status: RewardStatus;
  progressPercent: number;
  remainingCodes: number;
  market?: {
    id: string;
    name: string;
    slug: string;
    brandColor?: string | null;
    logoUrl?: string | null;
  } | null;
  claim?: {
    code: string;
    claimedAt: string;
    expiresAt?: string | null;
    source?: 'MANUAL' | 'AUTO';
  } | null;
}

export interface MyRewardsResponse {
  score: number;
  level: string;
  levelIcon: string;
  pitch: string;
  storeUsageNotice: string;
  rewards: CommunityRewardItem[];
  stats: {
    claimed: number;
    claimable: number;
    nextRewardTitle: string | null;
    nextRewardAt: number | null;
  };
}

export const getMyRewards = () =>
  api.get<{ data: MyRewardsResponse }>('/rewards/me').then((r) => r.data.data);

export const claimReward = (rewardId: string) =>
  api.post<{ data: {
    message: string;
    code: string;
    expiresAt?: string | null;
    instructions?: string | null;
    storeUsageNotice?: string;
    alreadyClaimed?: boolean;
    reward: { title: string; benefitText: string; discountLabel: string; marketName?: string };
  } }>(`/rewards/me/${rewardId}/claim`).then((r) => r.data.data);
