export function updateChecks(registration: ServiceWorkerRegistration) {
  let checking = false;
  async function check() {
    if (document.visibilityState !== 'visible' || !navigator.onLine || checking) return;
    checking = true;
    try { await registration.update(); }
    catch { /* Keep the cached app available when the server cannot be reached. */ }
    finally { checking = false; }
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  void check();
  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('pageshow', check);
    window.removeEventListener('online', check);
  };
}
