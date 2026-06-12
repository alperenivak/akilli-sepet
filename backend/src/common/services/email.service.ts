// =====================================================
// E-posta Servisi — axios ile (Brevo / Resend) veya console (dev)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

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
      await axios.post(
        'https://api.resend.com/emails',
        { from: `${fromName} <${from}>`, to: [to], subject, html, text },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      return;
    }

    // console modu gerçek e-posta göndermez — OTP için yapılandırılmış sağlayıcı gerekir
    this.logger.error(
      'E-posta gönderilemedi: EMAIL_PROVIDER=console. '
      + 'Resend veya Brevo için .env dosyasında EMAIL_PROVIDER ve API anahtarını tanımlayın.',
    );
    throw new Error(
      'E-posta servisi yapılandırılmamış. EMAIL_PROVIDER=resend (veya brevo) ve ilgili API anahtarını .env dosyasına ekleyin.',
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
