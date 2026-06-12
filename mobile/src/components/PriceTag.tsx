// Fiyat etiketi - kurus degerini TL olarak gosterir
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { formatPrice, COLORS } from '../utils/constants';

interface PriceTagProps {
  amount: number;       // Kurus cinsinden
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  previousAmount?: number; // Eski fiyat varsa ustu cizili goster
}

export const PriceTag: React.FC<PriceTagProps> = ({
  amount,
  size = 'md',
  color = COLORS.primary,
  previousAmount,
}) => {
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 22 : 16;

  return (
    <View style={styles.container}>
      {previousAmount && previousAmount !== amount && (
        <Text style={[styles.oldPrice, { fontSize: fontSize - 3 }]}>
          {formatPrice(previousAmount)}
        </Text>
      )}
      <Text style={[styles.price, { fontSize, color }]}>
        {formatPrice(amount)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end' },
  oldPrice: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  price: { fontWeight: '700' },
});
