export interface ColorVariant {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ColorPalette {
  primary: ColorVariant;
  secondary: ColorVariant;
  accent: ColorVariant;
  neutral: ColorVariant;
  success: ColorVariant;
  warning: ColorVariant;
  error: ColorVariant;
}

export const lightColors: ColorPalette = {
  primary: {
    50: '#eef7f9',
    100: '#dceff3',
    200: '#b6dde5',
    300: '#7dc3d2',
    400: '#37a3ba',
    500: '#007fa5',
    600: '#00668E',
    700: '#004b70',
    800: '#003662',
    900: '#0A2138',
    950: '#061423',
  },
  secondary: {
    50: '#f8f5f0',
    100: '#f0e8d8',
    200: '#e0d0b0',
    300: '#c9b08a',
    400: '#b8966a',
    500: '#a07d4d',
    600: '#8a6a3e',
    700: '#705432',
    800: '#5a4429',
    900: '#4a3822',
    950: '#2a1f12',
  },
  accent: {
    50: '#e9fbfd',
    100: '#cdf7fb',
    200: '#9ceef5',
    300: '#5de0eb',
    400: '#21d0e0',
    500: '#00C8DF',
    600: '#009dbb',
    700: '#00668E',
    800: '#004b70',
    900: '#003662',
    950: '#0A2138',
  },
  neutral: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    950: '#0c0a09',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  warning: {
    50: '#fbf3f3',
    100: '#f5dddd',
    200: '#eab8b7',
    300: '#d77f7d',
    400: '#b94442',
    500: '#8a1715',
    600: '#6c0c0a',
    700: '#4C0302',
    800: '#3d0201',
    900: '#300101',
    950: '#230000',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
};

export const darkColors: ColorPalette = {
  primary: {
    50: '#061423',
    100: '#0A2138',
    200: '#003662',
    300: '#004b70',
    400: '#00668E',
    500: '#007fa5',
    600: '#37a3ba',
    700: '#7dc3d2',
    800: '#b6dde5',
    900: '#dceff3',
    950: '#eef7f9',
  },
  secondary: {
    50: '#2a1f12',
    100: '#3a2e1a',
    200: '#4a3822',
    300: '#5a4429',
    400: '#705432',
    500: '#8a6a3e',
    600: '#a07d4d',
    700: '#b8966a',
    800: '#c9b08a',
    900: '#e0d0b0',
    950: '#f0e8d8',
  },
  accent: {
    50: '#0A2138',
    100: '#003662',
    200: '#004b70',
    300: '#00668E',
    400: '#009dbb',
    500: '#00C8DF',
    600: '#21d0e0',
    700: '#5de0eb',
    800: '#9ceef5',
    900: '#cdf7fb',
    950: '#e9fbfd',
  },
  neutral: {
    50: '#0c0a09',
    100: '#1c1917',
    200: '#292524',
    300: '#44403c',
    400: '#57534e',
    500: '#78716c',
    600: '#a8a29e',
    700: '#d6d3d1',
    800: '#e7e5e4',
    900: '#f5f5f4',
    950: '#fafaf9',
  },
  success: {
    50: '#052e16',
    100: '#14532d',
    200: '#166534',
    300: '#15803d',
    400: '#16a34a',
    500: '#22c55e',
    600: '#4ade80',
    700: '#86efac',
    800: '#bbf7d0',
    900: '#dcfce7',
    950: '#f0fdf4',
  },
  warning: {
    50: '#230000',
    100: '#300101',
    200: '#3d0201',
    300: '#4C0302',
    400: '#6c0c0a',
    500: '#8a1715',
    600: '#b94442',
    700: '#d77f7d',
    800: '#eab8b7',
    900: '#f5dddd',
    950: '#fbf3f3',
  },
  error: {
    50: '#450a0a',
    100: '#7f1d1d',
    200: '#991b1b',
    300: '#b91c1c',
    400: '#dc2626',
    500: '#ef4444',
    600: '#f87171',
    700: '#fca5a5',
    800: '#fecaca',
    900: '#fee2e2',
    950: '#fef2f2',
  },
};

export const colors = {
  light: lightColors,
  dark: darkColors,
};
