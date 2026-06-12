'use client';

import { useState } from 'react';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface Props {
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  maxLength?: number;
  showHint?: boolean;
}

export function BarcodeInputField({
  value,
  onChange,
  inputClassName = '',
  inputStyle,
  maxLength = 13,
  showHint = true,
}: Props) {
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleDetected = (code: string) => {
    onChange(code.slice(0, maxLength));
  };

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={maxLength}
          className={`flex-1 ${inputClassName}`}
          style={inputStyle}
          placeholder="8690526085013"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
        />
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
          title="Kamera ile barkod tara"
        >
          <span aria-hidden>📷</span>
          <span className="hidden sm:inline">Kamera ile Tara</span>
          <span className="sm:hidden">Tara</span>
        </button>
      </div>
      {showHint && (
        <p className="text-xs text-slate-400 mt-1.5">
          {value.length}/{maxLength} hane — mobil barkod taraması ile eşleşir
        </p>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetected}
      />
    </>
  );
}
