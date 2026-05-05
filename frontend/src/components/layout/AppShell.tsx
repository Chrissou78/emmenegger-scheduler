import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from '../../contexts/themeContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [view, setView] = useState('week');
  const [dept, setDept] = useState('all');
  const { th } = useTheme();

  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond','Garamond','Georgia',serif",
        background: th.bg,
        color: th.text,
        minHeight: '100vh',
        transition: 'background 0.4s ease, color 0.4s ease',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <Header view={view} setView={setView} dept={dept} setDept={setDept} />

      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <Outlet context={{ view, setView, dept, setDept }} />
        </main>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; border-radius: 3px; }
      `}</style>
    </div>
  );
}
