import { ThemeProvider } from '../../context/ThemeContext';
import { MarketSidebar } from '../../components/MarketSidebar';

export default function MarketPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="panel-root flex min-h-screen">
        <MarketSidebar />
        <main className="flex-1 overflow-auto" style={{ padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
