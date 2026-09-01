import { BarcodeFormat } from '@prisma/client';

export function normalizeBarcodeCode(raw: string): string {
  return raw.replace(/\D/g, '').trim();
}

export function detectBarcodeFormat(code: string): BarcodeFormat | null {
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 8) return BarcodeFormat.EAN_8;
  if (code.length === 12) return BarcodeFormat.UPC_A;
  if (code.length === 13) return BarcodeFormat.EAN_13;
  return null;
}

function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(code[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[12], 10);
}

function validateEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(code[i], 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[7], 10);
}

export function validateBarcodeCode(raw: string): {
  code: string;
  format: BarcodeFormat;
} {
  const code = normalizeBarcodeCode(raw);
  const format = detectBarcodeFormat(code);
  if (!format) {
    throw new Error('Barkod 8, 12 veya 13 haneli olmalıdır');
  }
  if (format === BarcodeFormat.EAN_13 && !validateEAN13(code)) {
    throw new Error('Geçersiz EAN-13 checksum');
  }
  if (format === BarcodeFormat.EAN_8 && !validateEAN8(code)) {
    throw new Error('Geçersiz EAN-8 checksum');
  }
  return { code, format };
}
