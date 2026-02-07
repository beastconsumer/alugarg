import { createTheme, rem } from '@mantine/core';

export const appTheme = createTheme({
  fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
  primaryColor: 'ocean',
  defaultRadius: 'md',
  colors: {
    ocean: [
      '#eef3ff',
      '#dbe6ff',
      '#b7cbff',
      '#8eadff',
      '#6992ff',
      '#4f81ff',
      '#0b5fff',
      '#0049d9',
      '#003db4',
      '#00318f',
    ],
    sand: [
      '#fdfaf4',
      '#f9f1e4',
      '#f3e8d3',
      '#e8d4ab',
      '#dcc083',
      '#d2ae62',
      '#c79c41',
      '#a88033',
      '#876628',
      '#654c1d',
    ],
  },
  headings: {
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
    fontWeight: '700',
  },
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: {
          fontWeight: 700,
          letterSpacing: rem(0.2),
        },
      },
    },
    Paper: {
      styles: {
        root: {
          borderColor: '#e5e7eb',
        },
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        size: 'md',
      },
    },
  },
});
