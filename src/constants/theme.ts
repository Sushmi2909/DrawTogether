import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const PaletteLight = {
  purple: '#6C5CE7',
  purpleDark: '#5A4BD1',
  purpleLight: '#A29BFE',
  coral: '#FF6B6B',
  teal: '#00CEC9',
  amber: '#FDCB6E',
  darkBg: '#1a1a2e',
  darkSurface: '#2a2a3e',
  darkBorder: '#3a3a4e',
  offWhite: '#F8F9FA',
  cardWhite: '#FFFFFF',
  textPrimary: '#212529',
  textSecondary: '#6B7280',
  textMuted: '#ADB5BD',
  success: '#22C55E',
  error: '#EF4444',
  border: '#E9ECEF',
  inputBg: '#F8F9FA',
  overlay: 'rgba(0,0,0,0.05)',
  bg: '#FFFFFF',
  surface: '#FFFFFF',
};

export const PaletteDark = {
  purple: '#A29BFE',
  purpleDark: '#6C5CE7',
  purpleLight: '#A29BFE',
  coral: '#FF6B6B',
  teal: '#00CEC9',
  amber: '#FDCB6E',
  darkBg: '#1a1a2e',
  darkSurface: '#2a2a3e',
  darkBorder: '#3a3a4e',
  offWhite: '#2D2D3D',
  cardWhite: '#1E1E2E',
  textPrimary: '#E8E8ED',
  textSecondary: '#9D9DB5',
  textMuted: '#6B6B85',
  success: '#22C55E',
  error: '#EF4444',
  border: '#3A3A4E',
  inputBg: '#2D2D3D',
  overlay: 'rgba(0,0,0,0.3)',
  bg: '#12121A',
  surface: '#1E1E2E',
};

export type PaletteType = typeof PaletteLight;

export { PaletteLight as Palette };

export const Radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};
