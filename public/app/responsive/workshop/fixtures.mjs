export const RESPONSIVE_WORKSHOP_FIXTURES = Object.freeze([
  Object.freeze({ id: 'desktop-landscape', label: 'Desktop landscape', width: 1440, height: 900, pointer: 'fine', hover: true, keyboard: true }),
  Object.freeze({ id: 'desktop-vertical', label: 'Desktop vertical', width: 1080, height: 1920, pointer: 'fine', hover: true, keyboard: true }),
  Object.freeze({ id: 'tablet-landscape', label: 'Tablet landscape', width: 1024, height: 768, pointer: 'coarse', hover: false, keyboard: false }),
  Object.freeze({ id: 'tablet-portrait', label: 'Tablet portrait', width: 820, height: 1180, pointer: 'coarse', hover: false, keyboard: false, safeArea: Object.freeze({ top: 24, right: 0, bottom: 20, left: 0 }) }),
  Object.freeze({ id: 'phone-landscape', label: 'Phone landscape', width: 740, height: 360, pointer: 'coarse', hover: false, keyboard: false, safeArea: Object.freeze({ top: 0, right: 18, bottom: 0, left: 18 }) }),
  Object.freeze({ id: 'phone-portrait', label: 'Phone portrait', width: 390, height: 844, pointer: 'coarse', hover: false, keyboard: false, reducedMotion: true, safeArea: Object.freeze({ top: 47, right: 0, bottom: 34, left: 0 }) })
]);
