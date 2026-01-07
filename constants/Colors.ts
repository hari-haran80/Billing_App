const tintColorLight = '#4a6da7';
const tintColorDark = '#a8c6ff';

export const Colors = {
  light: {
    text: '#2c3e50',
    textSecondary: '#7f8c8d',
    background: '#f5f7fa',
    cardBackground: '#ffffff',
    border: '#e9ecef',
    tint: tintColorLight,
    tabIconDefault: '#7f8c8d',
    tabIconSelected: tintColorLight,
    primary: '#4a6da7',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    placeholder: '#6c757d',
    inputBackground: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    textSecondary: '#adb5bd',
    background: '#121212',
    cardBackground: '#1e1e1e',
    border: '#333333',
    tint: tintColorDark,
    tabIconDefault: '#adb5bd',
    tabIconSelected: tintColorDark,
    primary: '#a8c6ff',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    placeholder: '#888888',
    inputBackground: '#2c2c2c',
  },
};

export type ColorScheme = 'light' | 'dark';

// Helper function to get colors based on color scheme
export const getColors = (colorScheme: ColorScheme) => {
  return Colors[colorScheme];
};