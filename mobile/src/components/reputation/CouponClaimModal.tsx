import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function CouponClaimModal({
  visible,
  code,
  title,
  instructions,
  storeUsageNotice,
  onClose,
}: {
  visible: boolean;
  code: string;
  title: string;
  instructions?: string | null;
  storeUsageNotice?: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Ionicons name="checkmark-circle" size={48} color="#15803d" />
          <Text style={s.title}>Kuponun Hazır!</Text>
          <Text style={s.sub}>{title}</Text>
          <View style={s.codeBox}>
            <Text style={s.code}>{code}</Text>
          </View>
          {instructions ? <Text style={s.hint}>{instructions}</Text> : null}
          {storeUsageNotice ? (
            <View style={s.noticeBox}>
              <Ionicons name="storefront-outline" size={16} color="#7c3aed" />
              <Text style={s.noticeTxt}>{storeUsageNotice}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.shareBtn}
            onPress={() => void Share.share({ message: `Akıllı Sepet kupon kodum: ${code}` })}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Kodu Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.close} onPress={onClose}>
            <Text style={s.closeTxt}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    alignItems: 'center', width: '100%', maxWidth: 340,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  sub: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' },
  codeBox: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 16,
    marginTop: 16, borderWidth: 2, borderColor: '#7c3aed', borderStyle: 'dashed',
    width: '100%', alignItems: 'center',
  },
  code: { fontSize: 22, fontWeight: '800', color: '#7c3aed', letterSpacing: 2 },
  hint: { fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 12, lineHeight: 16 },
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#faf5ff', borderRadius: 10, padding: 10,
    marginTop: 12, width: '100%', borderWidth: 1, borderColor: '#ede9fe',
  },
  noticeTxt: { flex: 1, fontSize: 11, color: '#5b21b6', lineHeight: 16 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#7c3aed', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 16,
  },
  shareTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  close: { marginTop: 12, padding: 8 },
  closeTxt: { color: '#94a3b8', fontWeight: '600' },
});
