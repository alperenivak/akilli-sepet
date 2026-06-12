'use client';

import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 12px',
        borderRadius: '12px',
        border: isDark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(15,23,42,0.08)',
        background: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Track */}
      <div style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: isDark ? '#3b82f6' : '#cbd5e1',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.3s',
      }}>
        <div style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: isDark ? 19 : 3,
          transition: 'left 0.25s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
        }}>
          {isDark ? '🌙' : '☀️'}
        </div>
      </div>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: isDark ? '#94a3b8' : '#64748b',
      }}>
        {isDark ? 'Gece Modu' : 'Gündüz Modu'}
      </span>
    </button>
  );
}
