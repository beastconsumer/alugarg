import { createTheme, rem } from '@mantine/core';

export const appTheme = createTheme({
  fontFamily: 'Manrope, Nunito Sans, Segoe UI, sans-serif',
  primaryColor: 'brandBlue',
  defaultRadius: 'lg',
  colors: {
    brandNavy: [
      '#eef2f8',
      '#d8e0ec',
      '#b1c0da',
      '#8aa0c9',
      '#5f7eb5',
      '#3f639c',
      '#2a4b7f',
      '#1b365f',
      '#122948',
      '#0b1f3b',
    ],
    brandBlue: [
      '#edf1ff',
      '#dbe4ff',
      '#b7c8ff',
      '#8eaaff',
      '#658cff',
      '#4a72ff',
      '#2f5bff',
      '#1e46da',
      '#1636ab',
      '#10267d',
    ],
    ocean: [
      '#edf1ff',
      '#dbe4ff',
      '#b7c8ff',
      '#8eaaff',
      '#658cff',
      '#4a72ff',
      '#2f5bff',
      '#1e46da',
      '#1636ab',
      '#10267d',
    ],
    brandSlate: [
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155',
      '#1e293b',
      '#0f172a',
      '#020617',
    ],
    brandGold: [
      '#fcf7ec',
      '#f8edd2',
      '#f0dca6',
      '#e8c978',
      '#ddb44f',
      '#d3a53a',
      '#c8a24a',
      '#a98336',
      '#866729',
      '#654c1d',
    ],
  },
  headings: {
    fontFamily: 'Space Grotesk, Manrope, Nunito Sans, sans-serif',
    fontWeight: '600',
  },
  shadows: {
    md: '0 14px 34px rgba(10, 21, 48, 0.1)',
    xl: '0 24px 56px rgba(8, 16, 36, 0.14)',
  },
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: {
          fontWeight: 700,
          letterSpacing: rem(0.15),
          transition: 'transform 120ms ease, box-shadow 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    Paper: {
      styles: {
        root: {
          borderColor: '#d5deea',
        },
      },
    },
    Card: {
      styles: {
        root: {
          borderColor: '#d5deea',
        },
      },
    },
    TextInput: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        input: {
          borderColor: '#cbd5e1',
          borderRadius: rem(12),
        },
      },
    },
    PasswordInput: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        input: {
          borderColor: '#cbd5e1',
          borderRadius: rem(12),
        },
      },
    },
    NumberInput: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        input: {
          borderColor: '#cbd5e1',
          borderRadius: rem(12),
        },
      },
    },
    Select: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        input: {
          borderColor: '#cbd5e1',
          borderRadius: rem(12),
        },
      },
    },
    Textarea: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        input: {
          borderColor: '#cbd5e1',
          borderRadius: rem(12),
        },
      },
    },
  },
});
