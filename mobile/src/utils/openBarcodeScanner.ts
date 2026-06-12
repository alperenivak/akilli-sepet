// =====================================================
// Barkod tarayici navigasyonu
// =====================================================

import { router } from 'expo-router';

/** Ana sayfa / arama / profil — tek dogru rota: /scan */
export function openBarcodeScanner() {
  router.push('/scan');
}
