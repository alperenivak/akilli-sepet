import { ThemeProvider } from '../../context/ThemeContext';
import { Sidebar } from '../../components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="panel-root flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto" style={{ padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
