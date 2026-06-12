/** Telefon karsilastirmasi icin normalize (son 10 hane, TR) */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('90')) {
    return digits.slice(2, 12);
  }
  if (digits.length >= 11 && digits.startsWith('0')) {
    return digits.slice(1, 11);
  }
  return digits.slice(-10);
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na.length >= 10 && na === nb;
}
