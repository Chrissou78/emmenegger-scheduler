import { useTheme } from '../contexts/themeContext';

export function MachinesPage() {
  const { th, t } = useTheme();

  return (
    <div style={{ color: th.text }}>
      <h1 style={{ color: th.gold }}>{t.machines}</h1>
      <p>Machines page coming soon...</p>
    </div>
  );
}
