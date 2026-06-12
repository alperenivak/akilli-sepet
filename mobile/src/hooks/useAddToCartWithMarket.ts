// =====================================================
// Sepete ekleme — market secimi zorunlu akis
// =====================================================

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { Product } from '../types/api';
import { showAppSuccess, showAppError } from '../store/messageStore';

interface PickerState {
  productId: string;
  productName: string;
}

export function useAddToCartWithMarket() {
  const addItem = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [adding, setAdding] = useState(false);

  const openPicker = useCallback((product: Pick<Product, 'id' | 'name'>) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Giriş Gerekli',
        'Sepete ürün eklemek için giriş yapmanız gerekiyor.',
        [
          { text: 'Vazgeç' },
          { text: 'Giriş Yap', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }
    setPicker({ productId: product.id, productName: product.name });
  }, [isAuthenticated]);

  const closePicker = useCallback(() => setPicker(null), []);

  const addWithMarket = useCallback(async (
    productId: string,
    productName: string,
    marketId: string,
    quantity = 1,
    options?: { closePicker?: boolean; successDetail?: string },
  ) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Giriş Gerekli',
        'Sepete ürün eklemek için giriş yapmanız gerekiyor.',
        [
          { text: 'Vazgeç' },
          { text: 'Giriş Yap', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }
    setAdding(true);
    try {
      await addItem(productId, marketId, quantity);
      showAppSuccess('Sepete Eklendi', options?.successDetail ?? productName);
      if (options?.closePicker) setPicker(null);
    } catch {
      showAppError('Hata', 'Sepete eklenirken bir sorun oluştu');
    } finally {
      setAdding(false);
    }
  }, [addItem, isAuthenticated]);

  const confirmAdd = useCallback(async (marketId: string, quantity: number) => {
    if (!picker) return;
    await addWithMarket(picker.productId, picker.productName, marketId, quantity, { closePicker: true });
  }, [addWithMarket, picker]);

  return {
    picker,
    adding,
    openPicker,
    closePicker,
    confirmAdd,
    addWithMarket,
  };
}
