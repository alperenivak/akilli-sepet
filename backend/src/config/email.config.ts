import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => {
  const brevoApiKey = process.env.BREVO_API_KEY?.trim() || undefined;
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || undefined;
  let provider = process.env.EMAIL_PROVIDER?.trim() || 'console';
  // API anahtarı varsa console yerine otomatik sağlayıcı seç
  if (provider === 'console' && resendApiKey) provider = 'resend';
  else if (provider === 'console' && brevoApiKey) provider = 'brevo';

  return {
  provider,
  from: process.env.EMAIL_FROM || 'noreply@akillisepet.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Akıllı Sepet',
  brevoApiKey,
  resendApiKey,
  otpExpiresMinutes: parseInt(process.env.EMAIL_OTP_EXPIRES_MINUTES || '10', 10),
  otpResendCooldownSeconds: parseInt(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  };
});
