// =====================================================
// Akıllı Sepet - Premium mesaj modalı
// =====================================================

import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMessageStore, MessageType } from '../../store/messageStore';
import { COLORS } from '../../utils/constants';

const META: Record<MessageType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: '#10b981', bg: '#ecfdf5' },
  error:   { icon: 'close-circle',     color: '#ef4444', bg: '#fef2f2' },
  warning: { icon: 'warning',          color: '#f59e0b', bg: '#fffbeb' },
  info:    { icon: 'information-circle', color: COLORS.primary, bg: COLORS.primaryLight },
};

export function AppMessageModal() {
  const { visible, type, title, message, actions, hide } = useMessageStore();
  const meta = META[type];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={hide}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={40} color={meta.color} />
          </View>
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          <View style={s.actions}>
            {actions.map((a, i) => (
              <TouchableOpacity
                key={`${a.label}-${i}`}
                style={[s.btn, a.primary ? { backgroundColor: meta.color } : s.btnGhost]}
                onPress={() => { a.onPress?.(); if (!a.onPress) hide(); }}
                activeOpacity={0.85}
              >
                <Text style={[s.btnTxt, a.primary ? s.btnTxtPrimary : s.btnTxtGhost]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  actions: { width: '100%', gap: 10 },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  btnTxt: { fontSize: 15, fontWeight: '700' },
  btnTxtPrimary: { color: '#fff' },
  btnTxtGhost: { color: '#475569' },
});
