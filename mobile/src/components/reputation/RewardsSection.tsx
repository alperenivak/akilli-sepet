// =====================================================
// Topluluk Ödülleri — İtibar karşılığı market kuponları
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, Share, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyRewards, claimReward, CommunityRewardItem } from '../../api/rewards';
import { showAppError, showAppSuccess } from '../../store/messageStore';
import { getApiErrorMessage } from '../../utils/constants';

function RewardCard({
  item,
  onClaim,
  claiming,
}: {
  item: CommunityRewardItem;
  onClaim: (id: string) => void;
  claiming: string | null;
}) {
  const isLocked = item.status === 'LOCKED';
  const isClaimed = item.status === 'CLAIMED';
  const isClaimable = item.status === 'CLAIMABLE';
  const isDepleted = item.status === 'DEPLETED';
  const brandColor = item.market?.brandColor ?? '#7c3aed';

  return (
    <View style={[rc.card, isClaimable && rc.cardHighlight]}>
      <View style={rc.cardTop}>
        <View style={[rc.marketBadge, { backgroundColor: `${brandColor}18` }]}>
          <Text style={rc.levelIcon}>{item.levelIcon}</Text>
        </View>
        <View style={rc.cardBody}>
          <View style={rc.titleRow}>
            <Text style={rc.marketName}>{item.market?.name ?? 'Partner'}</Text>
            <View style={[rc.discountPill, { backgroundColor: brandColor }]}>
              <Text style={rc.discountTxt}>{item.discountLabel}</Text>
            </View>
          </View>
          <Text style={rc.title}>{item.title}</Text>
          <Text style={rc.benefit}>{item.benefitText}</Text>
        </View>
      </View>

      {isLocked && (
        <View style={rc.progressWrap}>
          <View style={rc.progressBar}>
            <View style={[rc.progressFill, { width: `${item.progressPercent}%` }]} />
          </View>
          <Text style={rc.progressHint}>
            {item.levelLabel} için {item.minReputation.toFixed(1)} itibar — %{item.progressPercent}
          </Text>
        </View>
      )}

      {isClaimed && item.claim && (
        <TouchableOpacity
          style={rc.codeBox}
          onPress={() => Share.share({ message: `Akıllı Sepet kuponum: ${item.claim!.code}` })}
        >
          <Text style={rc.codeLabel}>Kupon Kodun</Text>
          <Text style={rc.codeValue}>{item.claim.code}</Text>
          <Text style={rc.codeShare}>Paylaş / kopyala için dokun</Text>
        </TouchableOpacity>
      )}

      {isClaimable && (
        <TouchableOpacity
          style={[rc.claimBtn, { backgroundColor: brandColor }]}
          onPress={() => onClaim(item.id)}
          disabled={claiming === item.id}
        >
          {claiming === item.id ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="gift-outline" size={16} color="#fff" />
              <Text style={rc.claimTxt}>Kuponu Al</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {isDepleted && (
        <Text style={rc.depletedTxt}>Kupon stoku tükendi — yakında yenilenecek</Text>
      )}
    </View>
  );
}

export function RewardsSection() {
  const queryClient = useQueryClient();
  const [claimedModal, setClaimedModal] = useState<{
    code: string;
    title: string;
    instructions?: string | null;
  } | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
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
      });
      showAppSuccess('Kupon hazır!', res.message);
    },
    onError: (err) => showAppError('Alınamadı', getApiErrorMessage(err, 'Kupon alınamadı.')),
    onSettled: () => setClaimingId(null),
  });

  const handleClaim = (id: string) => {
    setClaimingId(id);
    claimMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <View style={rs.wrap}>
        <ActivityIndicator color="#7c3aed" style={{ marginVertical: 24 }} />
      </View>
    );
  }

  if (isError || !data) return null;

  return (
    <View style={rs.wrap}>
      <View style={rs.header}>
        <Text style={rs.sectionTitle}>Market Kuponlarım</Text>
        <Text style={rs.sectionSub}>Topluluk katkın = gerçek indirim</Text>
      </View>

      <View style={rs.pitchCard}>
        <Ionicons name="sparkles" size={18} color="#7c3aed" />
        <Text style={rs.pitchText}>{data.pitch}</Text>
      </View>

      {data.stats.claimable > 0 && (
        <View style={rs.alertBanner}>
          <Ionicons name="gift" size={16} color="#15803d" />
          <Text style={rs.alertTxt}>{data.stats.claimable} kupon almaya hazır!</Text>
        </View>
      )}

      <View style={rs.list}>
        {data.rewards.map((r) => (
          <RewardCard
            key={r.id}
            item={r}
            onClaim={handleClaim}
            claiming={claimingId}
          />
        ))}
      </View>

      <Modal visible={!!claimedModal} transparent animationType="fade">
        <View style={rs.modalOverlay}>
          <View style={rs.modalCard}>
            <Ionicons name="checkmark-circle" size={48} color="#15803d" />
            <Text style={rs.modalTitle}>Kuponun Hazır!</Text>
            <Text style={rs.modalSub}>{claimedModal?.title}</Text>
            <View style={rs.modalCodeBox}>
              <Text style={rs.modalCode}>{claimedModal?.code}</Text>
            </View>
            {claimedModal?.instructions ? (
              <Text style={rs.modalHint}>{claimedModal.instructions}</Text>
            ) : null}
            <TouchableOpacity
              style={rs.modalShareBtn}
              onPress={() => {
                if (claimedModal) {
                  void Share.share({ message: `Akıllı Sepet kupon kodum: ${claimedModal.code}` });
                }
              }}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={rs.modalShareTxt}>Kodu Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rs.modalClose} onPress={() => setClaimedModal(null)}>
              <Text style={rs.modalCloseTxt}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const rs = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 16 },
  header: { marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  pitchCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#faf5ff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ede9fe', marginBottom: 12,
  },
  pitchText: { flex: 1, fontSize: 12, color: '#5b21b6', lineHeight: 17 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  alertTxt: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  list: { gap: 10 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', width: '100%', maxWidth: 340,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' },
  modalCodeBox: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 16,
    marginTop: 16, borderWidth: 2, borderColor: '#7c3aed', borderStyle: 'dashed',
    width: '100%', alignItems: 'center',
  },
  modalCode: { fontSize: 22, fontWeight: '800', color: '#7c3aed', letterSpacing: 2 },
  modalHint: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 12, lineHeight: 16 },
  modalShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#7c3aed', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 16,
  },
  modalShareTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalClose: { marginTop: 12, padding: 8 },
  modalCloseTxt: { color: '#94a3b8', fontWeight: '600' },
});

const rc = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardHighlight: { borderColor: '#c4b5fd', backgroundColor: '#fefcff' },
  cardTop: { flexDirection: 'row', gap: 12 },
  marketBadge: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  levelIcon: { fontSize: 22 },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  marketName: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  discountPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discountTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  title: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  benefit: { fontSize: 11, color: '#64748b', marginTop: 2 },
  progressWrap: { marginTop: 12 },
  progressBar: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#a78bfa', borderRadius: 3 },
  progressHint: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  codeBox: {
    marginTop: 12, backgroundColor: '#f0fdf4', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#bbf7d0', alignItems: 'center',
  },
  codeLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  codeValue: { fontSize: 18, fontWeight: '800', color: '#15803d', letterSpacing: 1, marginTop: 4 },
  codeShare: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 11, borderRadius: 12,
  },
  claimTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  depletedTxt: { fontSize: 11, color: '#94a3b8', marginTop: 10, textAlign: 'center' },
});
