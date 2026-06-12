// =====================================================
// API URL cozumleme — Expo Go LAN IP oncelikli
// Sabit IP kullanilmaz; telefon Metro ile ayni host'a baglanir
// =====================================================

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PRIVATE_LAN =
  /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

/** Hyper-V / WSL / Docker sanal ag — telefondan erisilemez */
const isVirtualAdapterHost = (host: string) =>
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

const isTunnelHost = (host: string) =>
  host.includes('exp.direct') || host.includes('ngrok') || host.includes('tunnel');

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url.trim()).hostname;
  } catch {
    return null;
  }
}

function isUsableDevHost(host: string): boolean {
  if (!host || host === 'localhost' || host === '127.0.0.1') return false;
  if (isTunnelHost(host) || isVirtualAdapterHost(host)) return false;
  return PRIVATE_LAN.test(host);
}

/** Expo Metro'nun gosterdigi IP — telefon zaten buna bagli */
function getExpoLanHost(): string | null {
  const debuggerHost = Constants.expoGoConfig?.debuggerHost?.split(':')[0];
  if (debuggerHost && isUsableDevHost(debuggerHost)) return debuggerHost;

  const hostUri = Constants.expoConfig?.hostUri?.split(':')[0];
  if (hostUri && isUsableDevHost(hostUri)) return hostUri;

  return null;
}

/** Kullanicinin .env veya app.config extra ile verdigi URL */
function getExplicitDevUrl(): string | null {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const host = hostFromUrl(envUrl);
    if (host && !isVirtualAdapterHost(host)) {
      return envUrl.replace(/\/$/, '');
    }
  }

  const extraUrl = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim();
  if (extraUrl) {
    const host = hostFromUrl(extraUrl);
    if (host && !isVirtualAdapterHost(host)) {
      return extraUrl.replace(/\/$/, '');
    }
  }

  return null;
}

export function resolveApiBaseUrl(): string {
  if (!__DEV__) {
    const prod = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (prod) return prod.replace(/\/$/, '');
    return 'https://api.akillisebet.com/api';
  }

  // 1) Expo LAN IP (en guvenilir — Metro ile ayni ag)
  const expoHost = getExpoLanHost();
  if (expoHost) return `http://${expoHost}:3001/api`;

  // 2) Kullanici acikca tanimladiysa
  const explicit = getExplicitDevUrl();
  if (explicit) return explicit;

  // 3) Emulator
  const isEmulator = Constants.isDevice === false;
  if (isEmulator && Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  if (isEmulator) return 'http://localhost:3001/api';

  // 4) Son care — localhost (fiziksel cihazda calismaz, hata mesajinda gosterilir)
  return 'http://localhost:3001/api';
}

/** Gosterim / hata mesajlari icin */
export function getApiUrlDebugInfo(): { url: string; source: string } {
  const url = resolveApiBaseUrl();
  if (!__DEV__) return { url, source: 'production' };

  if (getExpoLanHost()) return { url, source: 'Expo LAN (Metro IP)' };
  if (getExplicitDevUrl()) return { url, source: 'EXPO_PUBLIC_API_URL' };
  if (Constants.isDevice === false) return { url, source: 'emulator' };
  return { url, source: 'fallback — LAN IP algilanamadi' };
}
