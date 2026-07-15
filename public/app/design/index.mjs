import { GDL_VERSION, density, interaction, primitive, typography } from './tokens/foundations.mjs';
import { motion, semantic } from './tokens/semantic.mjs';

export { GDL_VERSION, density, interaction, motion, primitive, semantic, typography };

export const GDL = Object.freeze({
  version: GDL_VERSION,
  primitive,
  semantic,
  typography,
  density,
  interaction,
  motion
});

export function validateGdlTokens(tokens = GDL) {
  const errors = [];
  const requiredStates = ['arrived', 'enroute', 'processing', 'closed', 'overtime', 'warning', 'failed', 'saved', 'pending', 'stale', 'conflict'];
  const requiredThemes = ['dark', 'light'];
  const requiredDensities = ['command', 'standard', 'touch'];
  const themeKeys = ['surfaceCanvas', 'surfacePanel', 'surfaceRaised', 'surfaceCommand', 'textPrimary', 'textSecondary', 'textMuted', 'borderDefault', 'borderStrong'];

  requiredStates.forEach(key => {
    if (!tokens.semantic?.state?.[key]) errors.push(`Missing semantic state token: ${key}`);
  });

  requiredThemes.forEach(theme => {
    themeKeys.forEach(key => {
      if (!tokens.semantic?.[theme]?.[key]) errors.push(`Missing ${theme} theme token: ${key}`);
    });
  });

  requiredDensities.forEach(mode => {
    const value = tokens.density?.[mode];
    if (!value) errors.push(`Missing density mode: ${mode}`);
    else if (value.targetMinimum < 32) errors.push(`${mode} target minimum is below 32px`);
  });

  if (tokens.interaction?.minimumTouchTarget < 44) errors.push('Minimum touch target must be at least 44px.');
  if (JSON.stringify(tokens.primitive?.spacing) !== JSON.stringify([2, 4, 8, 12, 16, 20, 24, 32, 40, 48])) {
    errors.push('Spacing scale differs from the approved GDL scale.');
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
