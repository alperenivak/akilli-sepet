'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DetectedBarcode = { rawValue: string; format?: string };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 13);
}

function isSecureCameraContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerModal({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Kamera hazırlanıyor…');

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        const code = normalizeBarcode(codes[0].rawValue);
        if (code.length >= 8) {
          if (navigator.vibrate) navigator.vibrate(80);
          onDetected(code);
          handleClose();
          return;
        }
      }
    } catch {
      /* tek kare basarisiz — devam */
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [handleClose, onDetected]);

  useEffect(() => {
    if (!open) return;

    setError('');
    setStatus('Kamera hazırlanıyor…');

    if (!isSecureCameraContext()) {
      setError(
        'Kamera için güvenli bağlantı gerekir. Admin paneli telefonda https:// veya bilgisayarda localhost üzerinden açın.',
      );
      return;
    }

    if (!window.BarcodeDetector) {
      setError(
        'Bu tarayıcı kamera barkod okumayı desteklemiyor. Chrome veya Safari (güncel) kullanın veya barkodu elle girin.',
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        detectorRef.current = new window.BarcodeDetector!({ formats: SCAN_FORMATS });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setStatus('Barkodu çerçevenin içine hizalayın');
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError('Kamera izni reddedildi. Tarayıcı ayarlarından kamera erişimine izin verin.');
        } else if (msg.includes('NotFound')) {
          setError('Kamera bulunamadı. Cihazda çalışan bir kamera olmalı.');
        } else {
          setError('Kamera açılamadı. Sayfayı yenileyip tekrar deneyin.');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, scanFrame, stopCamera]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Barkod tarayıcı"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">Barkod Tara</p>
            <p className="text-xs text-slate-500">Telefon kamerası ile EAN / UPC okuma</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-lg leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
            >
              Kapat
            </button>
          </div>
        ) : (
          <>
            <div className="relative aspect-[4/3] bg-black">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[78%] max-w-xs aspect-[5/2] border-2 border-emerald-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            </div>
            <p className="px-4 py-3 text-center text-xs text-slate-500">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
