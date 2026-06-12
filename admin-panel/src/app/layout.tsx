import type { Metadata } from 'next';
import './globals.css';
import { AuthGuard } from '../components/AuthGuard';

export const metadata: Metadata = {
  title: 'Akıllı Sepet Admin Panel',
  description: 'Son kullanma tarihi ve fiyat karşılaştırma sistemi yönetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-gray-50">
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
