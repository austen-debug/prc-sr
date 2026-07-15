import { primitive } from './foundations.mjs';

export const semantic = Object.freeze({
  dark: Object.freeze({
    surfaceCanvas: primitive.color.navy950,
    surfacePanel: primitive.color.navy900,
    surfaceRaised: primitive.color.navy800,
    surfaceCommand: primitive.color.navy800,
    textPrimary: primitive.color.white,
    textSecondary: primitive.color.silver200,
    textMuted: primitive.color.blue300,
    borderDefault: primitive.color.blue700,
    borderStrong: primitive.color.blue500
  }),
  light: Object.freeze({
    surfaceCanvas: primitive.color.silver200,
    surfacePanel: primitive.color.silver100,
    surfaceRaised: primitive.color.white,
    surfaceCommand: primitive.color.navy800,
    textPrimary: primitive.color.navy950,
    textSecondary: primitive.color.navy800,
    textMuted: primitive.color.blue700,
    borderDefault: primitive.color.blue300,
    borderStrong: primitive.color.blue700
  }),
  state: Object.freeze({
    arrived: primitive.color.green500,
    enroute: primitive.color.cyan500,
    processing: primitive.color.blue500,
    closed: primitive.color.silver200,
    overtime: primitive.color.red600,
    warning: primitive.color.amber500,
    failed: primitive.color.red500,
    saved: primitive.color.green500,
    pending: primitive.color.amber500,
    stale: primitive.color.cyan500,
    conflict: primitive.color.red600
  })
});

export const motion = Object.freeze({
  enter: Object.freeze({ duration: primitive.duration.standard, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  exit: Object.freeze({ duration: primitive.duration.fast, easing: 'cubic-bezier(0.4, 0, 1, 1)' }),
  reduced: Object.freeze({ duration: 0, transform: 'none' })
});
