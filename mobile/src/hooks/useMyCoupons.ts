import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { getMyRewards, claimReward, CommunityRewardItem } from '../api/rewards';
import { showAppError, showAppSuccess } from '../store/messageStore';
import { getApiErrorMessage } from '../utils/constants';

export function useMyCoupons() {
  const queryClient = useQueryClient();
  const [claimedModal, setClaimedModal] = useState<{
    code: string;
    title: string;
    instructions?: string | null;
    storeUsageNotice?: string;
  } | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    staleTime: 60_000,
  });

  const claimMutation = useMutation({
    mutationFn: claimReward,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-rewards'] });
      setClaimedModal({
        code: res.code,
        title: res.reward.title,
        instructions: res.instructions,
        storeUsageNotice: res.storeUsageNotice,
      });
      if (!res.alreadyClaimed) {
        showAppSuccess('Kupon hazır!', res.message);
      }
    },
    onError: (err) => showAppError('Alınamadı', getApiErrorMessage(err, 'Kupon alınamadı.')),
    onSettled: () => setClaimingId(null),
  });

  const handleCouponPress = (item: CommunityRewardItem) => {
    if (item.status === 'LOCKED') {
      Alert.alert(
        'Henüz Kilitli',
        `${item.levelLabel} seviyesi için ${item.minReputation.toFixed(1)} itibar gerekli. Fiyat doğrula ve bildirerek itibarını artır!`,
      );
      return;
    }
    if (item.status === 'DEPLETED') {
      Alert.alert('Stok Tükendi', 'Bu kupon için manuel stok tükendi. Yakında yenilenecek veya otomatik moda geçilecek.');
      return;
    }
    if (item.status === 'CLAIMED' && item.claim) {
      setClaimedModal({
        code: item.claim.code,
        title: item.title,
        instructions: item.instructions,
        storeUsageNotice: query.data?.storeUsageNotice,
      });
      return;
    }
    if (item.status === 'CLAIMABLE') {
      setClaimingId(item.id);
      claimMutation.mutate(item.id);
    }
  };

  return {
    ...query,
    claimedModal,
    setClaimedModal,
    claimingId,
    handleCouponPress,
    isClaiming: claimMutation.isPending,
  };
}
