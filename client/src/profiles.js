// Perfiles de jugador para el hándicap por edad.
export const PROFILES = [
  { key: 'nino', label: '🧒 Niño', icon: '🧒' },
  { key: 'normal', label: '🙂 Normal', icon: '' },
  { key: 'mayor', label: '🧓 Mayor', icon: '🧓' },
];

export const profileIcon = (p) => (p === 'nino' ? '🧒' : p === 'mayor' ? '🧓' : '');
export const isPrivileged = (p) => p === 'nino' || p === 'mayor';
