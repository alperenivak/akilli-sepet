// =====================================================
// Akıllı Sepet - Profil Menu Ogesi Bileseni
// =====================================================

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

interface Props {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export function MenuItem({ icon, label, onPress, danger = false }: Props) {
  const color = danger ? COLORS.danger : COLORS.text;
  const iconBg = danger ? '#FEF2F2' : COLORS.primaryLight;
  const iconColor = danger ? COLORS.danger : COLORS.primary;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
      {!danger && (
        <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  label: { flex: 1, fontSize: 15, fontWeight: '500' },
});
