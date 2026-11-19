import { useCallback, useEffect, useState } from 'react';
import { formatNumber } from '../../domain';
import { LiveReader, type LiveReaderPlugin, type LiveReaderStatus } from '../../services/liveReader';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';

/**
 * „Citire automată (Android)”, pasul 0: pornirea serviciului și înregistrarea ecranelor Uber/Bolt
 * (cu datele personale ascunse), din care învățăm formatul ofertelor.
 */
export function LiveReaderSection({ plugin = LiveReader }: { plugin?: LiveReaderPlugin }) {
  const toast = useToast();
  const [status, setStatus] = useState<LiveReaderStatus | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await plugin.getStatus());
      setError(false);
    } catch {
      setError(true);
    }
  }, [plugin]);

  // La întoarcerea din Setările Android, starea poate fi alta.
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('resume', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('resume', onVisible);
    };
  }, [refresh]);

  const run = (fn: () => Promise<void>, done?: string) => async () => {
    try {
      await fn();
      if (done) toast(done);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'Nu a mers. Încearcă din nou.');
    }
    void refresh();
  };

  if (error) {
    return (
      <>
        <p className="section-label">Citire automată (Android)</p>
        <p className="small muted" style={{ margin: '0 4px' }}>Starea serviciului nu poate fi citită. Repornește aplicația.</p>
      </>
    );
  }
  if (!status) return null;

  const missing = [!status.uberInstalled && 'Uber Driver', !status.boltInstalled && 'Bolt Driver'].filter(Boolean);

  return (
    <>
      <p className="section-label">Citire automată (Android)</p>
      <div className="list">
        <div className="list-row" role="status">
          <span className="ico"><Icon name={status.serviceEnabled ? 'check' : 'bolt'} /></span>
          <span>
            <b>{status.serviceEnabled ? 'Serviciul e pornit' : 'Serviciul e oprit'}</b>
            <span className="sub" style={{ display: 'block' }}>
              {missing.length ? `Nu găsesc pe telefon: ${missing.join(', ')}` : 'Uber Driver și Bolt Driver sunt instalate'}
            </span>
          </span>
          <span />
        </div>
      </div>

      {!status.serviceEnabled && (
        <ol className="small" style={{ margin: '12px 4px 0', paddingLeft: 20, display: 'grid', gap: 10 }}>
          <li>
            <b>Permite setările restricționate.</b> Android le blochează la aplicațiile instalate din afara Magazinului Play.
            Deschide informațiile aplicației, apasă ⋮ (sus, dreapta) → <i>Permiteți setările restricționate</i>.
            <br />
            <button type="button" className="btn btn-small" style={{ marginTop: 6 }} onClick={run(() => plugin.openAppDetails())}>
              Deschide informațiile aplicației
            </button>
          </li>
          <li>
            <b>Pornește serviciul.</b> Accesibilitate → <i>Aplicații instalate</i> → <i>Drivio – citire curse</i> → Activat.
            <br />
            <button type="button" className="btn btn-small" style={{ marginTop: 6 }} onClick={run(() => plugin.openAccessibilitySettings())}>
              Deschide Accesibilitate
            </button>
          </li>
          <li>
            <b>Nu lăsa telefonul să-l oprească.</b> Pe Samsung: Setări → Baterie → Limite de utilizare în fundal → <i>Aplicații care nu intră niciodată în repaus</i> → adaugă Drivio.
            <br />
            <button type="button" className="btn btn-small" style={{ marginTop: 6 }} onClick={run(() => plugin.openBatterySettings())}>
              Deschide setările bateriei
            </button>
          </li>
        </ol>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={status.captureEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(() => plugin.setCaptureEnabled({ enabled }), enabled ? 'Înregistrarea a pornit' : 'Înregistrarea s-a oprit')();
            }}
          />
          <span>
            <b>Înregistrează ecranele Uber și Bolt</b>
            <br />
            <span className="muted">
              Ca să învățăm cum arată ofertele. Numele, adresele și telefoanele se ascund înainte de salvare. Înregistrările rămân pe
              telefon până apeși „Trimite”.
            </span>
          </span>
        </label>
        <p className="small muted" style={{ margin: '0 4px' }}>
          {status.captures === 0
            ? 'Niciun ecran înregistrat.'
            : `${formatNumber(status.captures, 0)} ${status.captures === 1 ? 'ecran înregistrat' : 'ecrane înregistrate'} · ${formatNumber(status.bytes / 1_000_000, 1)} MB`}
        </p>
        {status.captures > 0 && (
          <div className="grid-2">
            <button type="button" className="btn" onClick={run(() => plugin.shareCaptures())}>
              Trimite
            </button>
            <button type="button" className="btn btn-danger" onClick={run(() => plugin.clearCaptures(), 'Înregistrările au fost șterse')}>
              Șterge
            </button>
          </div>
        )}
      </div>
    </>
  );
}
