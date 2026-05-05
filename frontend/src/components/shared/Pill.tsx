import { useTheme } from '../../contexts/themeContext';

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function Pill({ active, onClick, children }: PillProps) {
  const { th } = useTheme();

  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px',
        border: 'none',
        borderRadius: 2,
        cursor: 'pointer',
        background: active ? th.switchActive : 'transparent',
        color: active ? th.gold : th.textDim,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: "'Outfit',sans-serif",
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </button>
  );
}
