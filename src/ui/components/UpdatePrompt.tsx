import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from './Toast';

/**
 * Înregistrează lucrătorul offline. Când apare o versiune nouă, o anunță; se instalează doar la
 * apăsarea „Actualizează”, deci niciodată în mijlocul introducerii unei curse. Datele nu sunt atinse.
 */
export function UpdatePrompt() {
  const toast = useToast();
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // verifică o dată pe oră dacă există o versiune nouă
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast('Aplicația funcționează acum și fără internet.');
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, toast]);

  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>Versiune nouă disponibilă.</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        Actualizează
      </button>
    </div>
  );
}
