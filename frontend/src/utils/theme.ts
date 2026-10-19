export type AccentThemeId = 'blue' | 'emerald' | 'violet' | 'gold';

export interface AccentTheme {
  id: AccentThemeId;
  name: string;
  description: string;
  primary: string;
  primaryHover: string;
  primarySubtle: string;
  primaryBorder: string;
  onPrimary: string;
}

const STORAGE_KEY = 'syncforge_accent_theme';

export const ACCENT_PRESETS: Record<AccentThemeId, AccentTheme> = {
  blue: {
    id: 'blue',
    name: 'Cyber Blue',
    description: 'High-clarity cobalt accent tuned for dark engineering consoles.',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primarySubtle: 'rgba(59, 130, 246, 0.14)',
    primaryBorder: 'rgba(59, 130, 246, 0.32)',
    onPrimary: '#ffffff',
  },
  emerald: {
    id: 'emerald',
    name: 'Neon Emerald',
    description: 'Crisp terminal phosphor green with high-contrast dark button ink.',
    primary: '#10b981',
    primaryHover: '#059669',
    primarySubtle: 'rgba(16, 185, 129, 0.14)',
    primaryBorder: 'rgba(16, 185, 129, 0.32)',
    onPrimary: '#08090a',
  },
  violet: {
    id: 'violet',
    name: 'Electric Violet',
    description: 'Deep synthesis violet for AI workflows and neural copilot focus.',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    primarySubtle: 'rgba(139, 92, 246, 0.14)',
    primaryBorder: 'rgba(139, 92, 246, 0.32)',
    onPrimary: '#ffffff',
  },
  gold: {
    id: 'gold',
    name: 'Sunset Gold',
    description: 'Warm amber instrumentation accent with dark WCAG AA button ink.',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    primarySubtle: 'rgba(245, 158, 11, 0.15)',
    primaryBorder: 'rgba(245, 158, 11, 0.34)',
    onPrimary: '#08090a',
  },
};

export function getStoredAccentTheme(): AccentThemeId {
  if (typeof window === 'undefined') return 'blue';
  const raw = localStorage.getItem(STORAGE_KEY) as AccentThemeId | null;
  if (raw && raw in ACCENT_PRESETS) {
    return raw;
  }
  return 'blue';
}

export function applyAccentTheme(themeId: AccentThemeId): AccentTheme {
  const theme = ACCENT_PRESETS[themeId] || ACCENT_PRESETS.blue;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-primary-hover', theme.primaryHover);
    root.style.setProperty('--color-primary-subtle', theme.primarySubtle);
    root.style.setProperty('--color-primary-border', theme.primaryBorder);
    root.style.setProperty('--color-on-primary', theme.onPrimary);
    root.style.setProperty('--color-primary-container', theme.primary);
    root.style.setProperty('--color-on-primary-container', theme.onPrimary);
    root.style.setProperty('--color-surface-tint', theme.primary);
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme.id);
    window.dispatchEvent(new CustomEvent('syncforge:theme-change', { detail: theme }));
  }
  return theme;
}

export function initAccentTheme(): AccentTheme {
  return applyAccentTheme(getStoredAccentTheme());
}
