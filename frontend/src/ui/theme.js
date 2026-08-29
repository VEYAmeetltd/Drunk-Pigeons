import { Platform } from 'react-native';

// Inject a punchy rounded display font on web (Fredoka) for the cartoon arcade look.
export function loadFonts() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('dp-fonts')) return;
  const link = document.createElement('link');
  link.id = 'dp-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
  document.head.appendChild(link);
}

export const FONT = Platform.OS === 'web' ? 'Fredoka, system-ui, sans-serif' : 'System';

export const COLORS = {
  bg: '#1b1030',
  bgAlt: '#271748',
  card: '#2f1d55',
  yellow: '#ffd23f',
  pink: '#ff5fa2',
  teal: '#3ef2c0',
  orange: '#ff7b54',
  text: '#ffffff',
  textDim: '#c7b8e6',
  lock: '#4a3a6b',
};
