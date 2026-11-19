import { useState } from 'react';
import { requestPersistentStorage } from '../../services/db';
import type { VehicleEntity } from '../../services/entities';
import { createSettings } from '../../services/repositories';
import { FinancialForm } from '../forms/FinancialForm';
import { VehicleForm } from '../forms/VehicleForm';

const CURRENCY = 'RON';

/** Ghidul de prima pornire: vehicul, comisioane, praguri. Nimic nu e pre-completat. */
export function Onboarding() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [vehicle, setVehicle] = useState<VehicleEntity | null>(null);

  return (
    <main className="app-main" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
      <p className="small muted" style={{ marginTop: 8 }} aria-live="polite">
        Pasul {step + 1} din 3
      </p>
      {step === 0 && (
        <section>
          <h1 className="screen-title" style={{ fontSize: 40, lineHeight: 1.05, margin: '24px 0 16px' }}>
            Află dacă o cursă merită, înainte s-o accepți.
          </h1>
          <p className="muted" style={{ maxWidth: '38ch' }}>
            Drivio calculează profitul real al fiecărei curse Uber și Bolt: comision, energie, uzură și kilometrii până la client.
          </p>
          <div className="panel" style={{ marginTop: 24 }}>
            <p className="panel-title">Ai nevoie de</p>
            <ul className="muted" style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>consumul și prețul energiei sau al combustibilului;</li>
              <li>cât te costă pe km mentenanța și deprecierea mașinii;</li>
              <li>comisioanele Uber și Bolt.</li>
            </ul>
            <p className="small muted" style={{ marginTop: 10 }}>Datele rămân doar pe acest telefon. Le poți schimba oricând din Setări.</p>
          </div>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 24 }} onClick={() => setStep(1)}>
            Începe
          </button>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="screen-title" style={{ margin: '12px 0 16px' }}>Mașina ta</h1>
          <VehicleForm
            vehicle={vehicle ?? undefined}
            currency={CURRENCY}
            submitLabel="Continuă"
            onSaved={(v) => {
              setVehicle(v);
              setStep(2);
            }}
          />
        </section>
      )}

      {step === 2 && vehicle && (
        <section>
          <div className="row" style={{ margin: '12px 0 8px' }}>
            <h1 className="screen-title">Comisioane și praguri</h1>
          </div>
          <button type="button" className="link-btn" onClick={() => setStep(1)}>
            Înapoi la mașină
          </button>
          <FinancialForm
            currency={CURRENCY}
            submitLabel="Gata, deschide aplicația"
            onSubmit={async (f) => {
              await createSettings({ currency: CURRENCY, commissionPct: f.commissionPct, thresholds: f.thresholds }, vehicle.id);
              void requestPersistentStorage();
            }}
          />
        </section>
      )}
    </main>
  );
}
