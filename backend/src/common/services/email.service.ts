// =====================================================
// E-posta Servisi — Brevo / Resend / SMTP / console (dev)
// Provider önceliği: EMAIL_PROVIDER env → otomatik key tespiti
// SMTP: Gmail, Outlook, Yandex vb. herhangi bir SMTP destekler
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const provider = this.config.get<string>('email.provider', 'console');
    const from     = this.config.get<string>('email.from', 'noreply@akillisepet.com');
    switch (provider) {
      case 'resend': {
        const ok = Boolean(this.config.get<string>('email.resendApiKey'));
        this.logger.log(`E-posta: Resend (${from}) — API key ${ok ? 'tanımlı ✓' : 'EKSİK ✗'}`);
        break;
      }
      case 'brevo': {
        const ok = Boolean(this.config.get<string>('email.brevoApiKey'));
        this.logger.log(`E-posta: Brevo (${from}) — API key ${ok ? 'tanımlı ✓' : 'EKSİK ✗'}`);
        break;
      }
      case 'smtp': {
        const smtp = this.config.get<{ host?: string; user?: string }>('email.smtp');
        this.logger.log(`E-posta: SMTP (${smtp?.host ?? '?'}) kullanıcı=${smtp?.user ?? '?'} gönderici=${from}`);
        break;
      }
      default:
        this.logger.warn('E-posta: console modu — OTP e-postası gönderilmez. EMAIL_PROVIDER ayarlayın.');
    }
  }

  private formatProviderError(provider: string, err: unknown): string {
    if (isAxiosError(err)) {
      const body = err.response?.data;
      const detail = typeof body === 'object' && body !== null
        ? JSON.stringify(body)
        : String(body ?? err.message);
      return `${provider} API hatası (${err.response?.status ?? 'network'}): ${detail}`;
    }
    return (err as Error).message;
  }

  async sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
    const provider = this.config.get<string>('email.provider', 'console');
    const from = this.config.get<string>('email.from', 'noreply@akillisepet.com');
    const fromName = this.config.get<string>('email.fromName', 'Akıllı Sepet');

    if (provider === 'brevo') {
      const apiKey = this.config.get<string>('email.brevoApiKey');
      if (!apiKey) throw new Error('BREVO_API_KEY yapılandırılmamış');
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { email: from, name: fromName },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        },
        { headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      return;
    }

    if (provider === 'resend') {
      const apiKey = this.config.get<string>('email.resendApiKey');
      if (!apiKey) throw new Error('RESEND_API_KEY yapılandırılmamış');
      try {
        await axios.post(
          'https://api.resend.com/emails',
          { from: `${fromName} <${from}>`, to: [to], subject, html, text },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000 },
        );
        this.logger.log(`OTP e-postası gönderildi (Resend → ${to})`);
      } catch (err) {
        const msg = this.formatProviderError('Resend', err);
        this.logger.error(msg);
        throw new Error(msg);
      }
      return;
    }

    if (provider === 'smtp') {
      const smtp = this.config.get<{
        host?: string; port?: number; secure?: boolean; user?: string; pass?: string;
      }>('email.smtp');
      if (!smtp?.host || !smtp.user || !smtp.pass) {
        throw new Error('SMTP yapılandırması eksik: SMTP_HOST, SMTP_USER ve SMTP_PASS gerekli');
      }
      const transporter = nodemailer.createTransport({
        host:              smtp.host,
        port:              smtp.port ?? 587,
        secure:            smtp.secure ?? false,
        auth:              { user: smtp.user, pass: smtp.pass },
        connectionTimeout: 10000,   // 10s bağlantı zaman aşımı
        greetingTimeout:   8000,
        socketTimeout:     15000,
      });
      try {
        await transporter.sendMail({
          from:    `"${fromName}" <${smtp.user}>`,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`OTP e-postası gönderildi (SMTP/${smtp.host} → ${to})`);
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.error(`SMTP hatası: ${msg}`);
        throw new Error(`SMTP gönderi hatası: ${msg}`);
      }
      return;
    }

    // console modu — geliştirme ortamı
    this.logger.error(
      'E-posta gönderilemedi: EMAIL_PROVIDER ayarlanmamış veya "console". '
      + 'Brevo (ücretsiz, domain gerekmez): EMAIL_PROVIDER=brevo + BREVO_API_KEY. '
      + 'Gmail SMTP: EMAIL_PROVIDER=smtp + SMTP_HOST=smtp.gmail.com + SMTP_USER + SMTP_PASS.',
    );
    throw new Error(
      'E-posta servisi yapılandırılmamış. Desteklenen: brevo, resend, smtp. '
      + 'Brevo ücretsiz 300 mail/gün, herhangi bir adrese gönderir.',
    );
  }

  async sendOtpCode(to: string, code: string, purpose: 'register' | 'password_reset'): Promise<void> {
    const appName = this.config.get<string>('email.fromName', 'Akıllı Sepet');
    const subject = purpose === 'register'
      ? `${appName} — Kayıt Doğrulama Kodu`
      : `${appName} — Şifre Sıfırlama Kodu`;

    const action = purpose === 'register'
      ? 'hesap oluşturma işleminizi tamamlamak'
      : 'şifrenizi sıfırlamak';

    const text = [
      `${appName} güvenlik kodunuz: ${code}`,
      '',
      `Bu kodu ${action} için kullanın.`,
      'Kod 10 dakika geçerlidir. Kimseyle paylaşmayın.',
      '',
      'Bu isteği siz yapmadıysanız bu e-postayı yok sayın.',
    ].join('\n');

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#E63329">${appName}</h2>
        <p>Güvenlik kodunuz:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111">${code}</p>
        <p style="color:#666;font-size:14px">Bu kodu <strong>${action}</strong> için kullanın. Kod 10 dakika geçerlidir.</p>
        <p style="color:#999;font-size:12px">Bu isteği siz yapmadıysanız bu e-postayı yok sayın.</p>
      </div>`;

    await this.sendMail(to, subject, text, html);
  }
}
