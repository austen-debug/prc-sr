export const GDL_VERSION = '2A.1.0';

export const primitive = Object.freeze({
  color: Object.freeze({
    navy950: '#07111f', navy900: '#0b1728', navy800: '#11243c', blue700: '#245987',
    blue500: '#3f7fb5', blue300: '#85b4d8', silver200: '#c8d2dc', silver100: '#e8edf2',
    white: '#ffffff', black: '#000000', green500: '#2f8f63', amber500: '#c58a1b',
    red600: '#b43b45', red500: '#d4535c', cyan500: '#3b9db4'
  }),
  spacing: Object.freeze([2, 4, 8, 12, 16, 20, 24, 32, 40, 48]),
  radius: Object.freeze({ none: 0, xs: 2, sm: 4, md: 8, lg: 12, pill: 999 }),
  duration: Object.freeze({ instant: 0, fast: 120, standard: 180, deliberate: 260 }),
  layer: Object.freeze({ base: 0, sticky: 100, navigation: 300, sheet: 500, dialog: 700, notification: 900 })
});

export const typography = Object.freeze({
  family: Object.freeze({ ui: 'Inter, ui-sans-serif, system-ui, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' }),
  size: Object.freeze({ xs: 12, sm: 14, md: 16, lg: 20, xl: 24, display: 32 }),
  weight: Object.freeze({ regular: 400, medium: 500, semibold: 600, bold: 700 }),
  lineHeight: Object.freeze({ tight: 1.15, standard: 1.4, relaxed: 1.6 })
});

export const density = Object.freeze({
  command: Object.freeze({ controlHeight: 32, rowHeight: 32, cardPadding: 8, gap: 8, targetMinimum: 32 }),
  standard: Object.freeze({ controlHeight: 40, rowHeight: 40, cardPadding: 16, gap: 12, targetMinimum: 40 }),
  touch: Object.freeze({ controlHeight: 48, rowHeight: 48, cardPadding: 20, gap: 16, targetMinimum: 44 })
});

export const interaction = Object.freeze({
  focusRingWidth: 3,
  focusRingOffset: 2,
  minimumTouchTarget: 44,
  disabledOpacity: 0.48
});
