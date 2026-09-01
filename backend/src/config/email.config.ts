import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => {
  const brevoApiKey   = process.env.BREVO_API_KEY?.trim()   || undefined;
  const resendApiKey  = process.env.RESEND_API_KEY?.trim()  || undefined;
  const smtpHost      = process.env.SMTP_HOST?.trim()       || undefined;
  const smtpUser      = process.env.SMTP_USER?.trim()       || undefined;
  const smtpPass      = process.env.SMTP_PASS?.trim()       || undefined;
  const smtpPort      = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure    = process.env.SMTP_SECURE === 'true';  // true = 465 SSL

  let provider = (process.env.EMAIL_PROVIDER?.trim() || 'console').toLowerCase();

  // Tanımlı API key varsa console'dan otomatik sağlayıcıya yükselt
  if (provider === 'console') {
    if      (resendApiKey) provider = 'resend';
    else if (brevoApiKey)  provider = 'brevo';
    else if (smtpHost && smtpUser && smtpPass) provider = 'smtp';
  }

  return {
    provider,
    from:     process.env.EMAIL_FROM?.trim()      || 'noreply@akillisepet.com',
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'Akıllı Sepet',
    brevoApiKey,
    resendApiKey,
    smtp: smtpHost ? { host: smtpHost, port: smtpPort, secure: smtpSecure, user: smtpUser, pass: smtpPass } : undefined,
    otpExpiresMinutes:       parseInt(process.env.EMAIL_OTP_EXPIRES_MINUTES          || '10', 10),
    otpResendCooldownSeconds: parseInt(process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  };
});
