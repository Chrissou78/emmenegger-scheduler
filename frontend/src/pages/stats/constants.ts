// frontend/src/pages/stats/constants.ts

export const ABS_LABELS: Record<string, Record<string, string>> = {
  de: { '1': 'Krankheit', '2': 'Urlaub', '3': 'Fortbildung', '4': 'Dienstreise', '5': 'Homeoffice', '6': 'Sonstiges' },
  en: { '1': 'Illness', '2': 'Vacation', '3': 'Training', '4': 'Business Trip', '5': 'Home Office', '6': 'Other' },
  fr: { '1': 'Maladie', '2': 'Vacances', '3': 'Formation', '4': 'Déplacement', '5': 'Télétravail', '6': 'Autre' },
  pt: { '1': 'Doença', '2': 'Férias', '3': 'Formação', '4': 'Viagem', '5': 'Home Office', '6': 'Outro' },
};

export const ABS_COLORS: Record<string, string> = {
  '1': '#ff6b9d', '2': '#00e5a0', '3': '#ffa726', '4': '#00bcd4', '5': '#b388ff', '6': '#78909c',
};

export function getNeonColors(isDark: boolean) {
  return {
    occupation: '#00e5a0',
    success: '#00e5a0',
    absence: '#ff6b9d',
    machine: '#00bcd4',
    track: isDark ? '#1e2a2a' : '#e0ece8',
    green: '#00e5a0',
    red: '#ff6b9d',
    orange: '#ffa726',
    blue: '#00bcd4',
    purple: '#7c4dff',
    report: '#b388ff',
  };
}
