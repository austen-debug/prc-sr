export async function registerGateShellServiceWorker({
  serviceWorker = globalThis.navigator?.serviceWorker,
  scriptUrl = '/gate-build-2-sw.js',
  scope = '/'
} = {}) {
  if (!serviceWorker || typeof serviceWorker.register !== 'function') {
    return Object.freeze({ supported: false, registered: false, registration: null });
  }
  const registration = await serviceWorker.register(scriptUrl, { scope, type: 'module' });
  return Object.freeze({ supported: true, registered: true, registration });
}
