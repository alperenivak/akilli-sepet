// =====================================================
// Akıllı Sepet - Sepet Islem Hook'u
// Optimizasyon, guncelleme ve kaldirma islemleri
// =====================================================

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { CartOptimizationResult } from '../types/api';

export function useCartActions() {
  const { optimize, updateItem, removeItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [optimization, setOptimization] = useState<CartOptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const handleOptimize = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Giriş Gerekli',
        'Sepet analizi için giriş yapmanız gerekiyor.',
        [
          { text: 'Vazgeç' },
          { text: 'Giriş Yap', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }

    setOptimizing(true);
    try {
      const result = await optimize();
      setOptimization(result);
    } catch {
      Alert.alert('Hata', 'Sepet analizi hesaplanırken bir sorun oluştu');
    } finally {
      setOptimizing(false);
    }
  }, [isAuthenticated, optimize]);

  const handleUpdateQuantity = useCallback(async (itemId: string, newQty: number) => {
    if (newQty === 0) {
      await removeItem(itemId);
    } else {
      await updateItem(itemId, newQty);
    }
    setOptimization(null);
  }, [removeItem, updateItem]);

  return { optimization, optimizing, handleOptimize, handleUpdateQuantity };
}
