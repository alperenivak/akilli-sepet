import { ThemeProvider } from '../../context/ThemeContext';
import { InspectorSidebar } from '../../components/InspectorSidebar';

export default function InspectorPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="panel-root flex min-h-screen">
        <InspectorSidebar />
        <main className="flex-1 overflow-auto" style={{ padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
