import api from './client';
import { AuthResponse, User } from '../types/api';

// E-posta OTP gonder
export const sendOtp = (data: {
  email: string;
  purpose: 'REGISTER' | 'PASSWORD_RESET';
}) =>
  api.post<{ data: { message: string; expiresInMinutes: number } }>('/auth/otp/send', data)
    .then((r) => r.data.data ?? r.data);

// Kayit ol (OTP dogrulamali)
export const register = (data: {
  email: string;
  password: string;
  name: string;
  surname: string;
  phone?: string;
  verificationCode: string;
}) => api.post<{ data: AuthResponse }>('/auth/register', data).then((r) => r.data.data);

// Giris yap
export const login = (data: { email: string; password: string }) =>
  api.post<{ data: AuthResponse }>('/auth/login', data).then((r) => r.data.data);

// Cikis yap
export const logout = () =>
  api.post('/auth/logout').catch(() => null);

// Mevcut kullanici bilgisi
export const getMe = () =>
  api.get<{ data: User }>('/auth/me').then((r) => r.data.data);

// Sifre degistir (giris yapmis kullanici)
export const changePassword = (data: {
  currentPassword: string;
  newPassword: string;
}) => api.patch('/auth/change-password', data).then((r) => r.data);

// Sifre sifirla (e-posta OTP ile)
export const resetPassword = (data: {
  email: string;
  verificationCode: string;
  newPassword: string;
}) =>
  api.post<{ data: { message: string } }>('/auth/reset-password', data).then((r) => r.data.data);

// Token yenile
export const refreshToken = (refreshToken: string) =>
  api.post<{ data: { accessToken: string } }>('/auth/refresh', { refreshToken })
     .then((r) => r.data.data);
