/** Înlocuitor pentru „virtual:pwa-register/react” în teste (modulul real există doar în build-ul Vite). */
export function useRegisterSW() {
  const noop = () => {};
  return {
    needRefresh: [false, noop] as const,
    offlineReady: [false, noop] as const,
    updateServiceWorker: async () => {},
  };
}
