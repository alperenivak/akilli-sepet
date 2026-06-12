'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '../../lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sendCode = async () => {
    if (!email.trim()) {
      setError('E-posta adresinizi girin.');
      return;
    }
    setOtpSending(true);
    setError('');
    try {
      const res = await authApi.sendOtp(email.trim().toLowerCase(), 'PASSWORD_RESET');
      setCode('');
      setMessage(res.message ?? 'Doğrulama kodu e-posta adresinize gönderildi.');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Kod gönderilemedi.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('6 haneli doğrulama kodunu girin.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        verificationCode: code.trim(),
        newPassword: password,
      });
      setMessage(res.message ?? 'Şifreniz güncellendi. Yönlendiriliyorsunuz…');
      setTimeout(() => router.replace('/'), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Sıfırlama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080d1a] p-4">
      <div className="w-full max-w-md bg-gray-900/80 border border-gray-700 rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Şifremi Unuttum</h1>
          <p className="text-sm text-gray-400 mt-1">
            E-postanıza gelen kod ile yeni şifre belirleyin (admin, denetçi ve market panelleri).
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-300 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2">{error}</div>
        )}
        {message && (
          <div className="text-sm text-green-300 bg-green-950/40 border border-green-800/40 rounded-xl px-3 py-2">{message}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-gray-400">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </div>

          <button
            type="button"
            onClick={sendCode}
            disabled={otpSending}
            className="w-full py-2.5 rounded-xl border border-blue-500/50 text-blue-300 text-sm font-semibold hover:bg-blue-500/10 disabled:opacity-50"
          >
            {otpSending ? 'Gönderiliyor…' : 'Sıfırlama Kodu Gönder'}
          </button>

          <div>
            <label className="text-sm text-gray-400">Doğrulama kodu (6 hane)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm tracking-widest"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Yeni şifre</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Yeni şifre tekrar</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full mt-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Güncelleniyor…' : 'Şifremi Sıfırla'}
          </button>
        </form>

        <Link href="/" className="block text-center text-sm text-gray-500 hover:text-gray-300">
          ← Giriş ekranına dön
        </Link>
      </div>
    </div>
  );
}
