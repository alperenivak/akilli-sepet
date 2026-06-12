import React from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommunityRewardItem } from '../../api/rewards';

const STATUS_HINT: Record<string, string> = {
  LOCKED: 'Kilidi açmak için dokun',
  CLAIMABLE: 'Kuponu almak için dokun',
  CLAIMED: 'Kodunu görmek için dokun',
  DEPLETED: 'Stok tükendi',
};

export function CouponCard({
  item,
  onPress,
  claiming,
}: {
  item: CommunityRewardItem;
  onPress: (item: CommunityRewardItem) => void;
  claiming: string | null;
}) {
  const isLocked = item.status === 'LOCKED';
  const isClaimed = item.status === 'CLAIMED';
  const isClaimable = item.status === 'CLAIMABLE';
  const isDepleted = item.status === 'DEPLETED';
  const brandColor = item.market?.brandColor ?? '#7c3aed';
  const isBusy = claiming === item.id;

  return (
    <Pressable
      onPress={() => onPress(item)}
      disabled={isBusy}
      style={({ pressed }) => [
        rc.card,
        isClaimable && rc.cardHighlight,
        isClaimed && rc.cardClaimed,
        pressed && !isDepleted && rc.cardPressed,
      ]}
    >
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
        <Ionicons
          name={isClaimed ? 'checkmark-circle' : isClaimable ? 'gift' : 'lock-closed-outline'}
          size={20}
          color={isClaimed ? '#15803d' : isClaimable ? brandColor : '#94a3b8'}
        />
      </View>

      {isLocked && (
        <View style={rc.progressWrap}>
          <View style={rc.progressBar}>
            <View style={[rc.progressFill, { width: `${item.progressPercent}%` }]} />
          </View>
          <Text style={rc.progressHint}>
            {item.levelLabel} · {item.minReputation.toFixed(1)} itibar — %{item.progressPercent}
          </Text>
        </View>
      )}

      {isClaimed && item.claim && (
        <View style={rc.codeBox}>
          <Text style={rc.codeLabel}>Kupon Kodun</Text>
          <Text style={rc.codeValue}>{item.claim.code}</Text>
        </View>
      )}

      <View style={rc.footer}>
        {isBusy ? (
          <ActivityIndicator color={brandColor} size="small" />
        ) : (
          <Text style={[rc.hintTxt, isClaimable && { color: brandColor, fontWeight: '700' }]}>
            {STATUS_HINT[item.status]}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

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
  cardClaimed: { borderColor: '#bbf7d0', backgroundColor: '#fafffe' },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
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
  footer: { marginTop: 10, alignItems: 'center', minHeight: 18 },
  hintTxt: { fontSize: 11, color: '#94a3b8' },
});
