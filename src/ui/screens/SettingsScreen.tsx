import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useState } from 'react';
import { buildCostSnapshot, formatNumber } from '../../domain';
import { undoLastRestore } from '../../services/backup';
import { useRestorePoint } from '../sheets/DataSheets';
import { FixedCostsSheet, GoalsSheet } from '../sheets/FinanceSheets';
import { useVehicles } from '../../features/hooks';
import type { AppSettings, ThemePreference, VehicleEntity } from '../../services/entities';
import { setVehicleArchived, updateSettings } from '../../services/repositories';
import { Icon } from '../components/Icon';
import { Segmented, SelectField } from '../components/controls';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { FinancialForm } from '../forms/FinancialForm';
import { VehicleForm } from '../forms/VehicleForm';
import { isAndroidApp } from '../../services/liveReader';
import { LiveReaderSection } from './LiveReaderSection';
import { money, perKm } from '../format';
import { POWERTRAIN_LABEL } from '../text';

const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP', 'MDL', 'HUF', 'BGN', 'PLN', 'CZK'] as const;

export type DataSheetKind = 'backup' | 'restore' | 'export' | 'trash';

export function SettingsScreen({ settings, onOpenData }: { settings: AppSettings; onOpenData: (k: DataSheetKind) => void }) {
  const vehicles = useVehicles(true);
  const toast = useToast();
  const restorePoint = useRestorePoint();
  const [editing, setEditing] = useState<VehicleEntity | 'new' | null>(null);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [panel, setPanel] = useState<'goals' | 'fixed' | null>(null);
  const c = settings.currency;

  const active = vehicles?.filter((v) => !v.archived) ?? [];
  const archived = vehicles?.filter((v) => v.archived) ?? [];

  return (
    <>
      <p className="section-label" style={{ marginTop: 0 }}>Vehicule</p>
      <div className="list">
        {active.map((v) => {
          const s = buildCostSnapshot(v, 0);
          const isActive = v.id === settings.activeVehicleId;
          return (
            <button key={v.id} type="button" className="list-row" onClick={() => setEditing(v)}>
              <span className="ico"><Icon name={v.powertrain === 'electric' ? 'bolt' : 'car'} /></span>
              <span>
                <b>{v.name}</b>
                <span className="sub" style={{ display: 'block' }}>
                  {POWERTRAIN_LABEL[v.powertrain]} · {perKm(s.energyCostPerKm + s.wearCostPerKm, c)}
                </span>
              </span>
              <span className="end small">{isActive ? 'activ' : <Icon name="chevronRight" width={18} height={18} />}</span>
            </button>
          );
        })}
        <button type="button" className="list-row" onClick={() => setEditing('new')}>
          <span className="ico"><Icon name="plus" /></span>
          <b>Adaugă vehicul</b>
          <span />
        </button>
      </div>
      {archived.length > 0 && (
        <p className="small muted" style={{ margin: '8px 4px' }}>
          Arhivate: {archived.map((v, i) => (
            <span key={v.id}>
              {i > 0 && ', '}
              <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setEditing(v)}>{v.name}</button>
            </span>
          ))}
        </p>
      )}

      <p className="section-label">Financiar</p>
      <div className="list">
        <button type="button" className="list-row" onClick={() => setFinancialOpen(true)}>
          <span className="ico"><Icon name="percent" /></span>
          <span>
            <b>Comisioane și praguri</b>
            <span className="sub" style={{ display: 'block' }}>
              Uber {formatNumber(settings.commissionPct.uber, 1)}% · Bolt {formatNumber(settings.commissionPct.bolt, 1)}% · verde de la {formatNumber(settings.thresholds.greenFromPerHour, 0)} {c}/oră
            </span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        <button type="button" className="list-row" onClick={() => setPanel('goals')}>
          <span className="ico"><Icon name="target" /></span>
          <span>
            <b>Obiective și rezervă pentru taxe</b>
            <span className="sub" style={{ display: 'block' }}>
              {settings.goals.dailyMinor !== null ? `Zilnic ${money(settings.goals.dailyMinor, c)}` : 'Fără obiectiv zilnic'}
              {settings.goals.monthlyMinor !== null ? ` · lunar ${money(settings.goals.monthlyMinor, c)}` : ''}
              {settings.taxReservePct > 0 ? ` · rezervă ${formatNumber(settings.taxReservePct, 0)}%` : ''}
            </span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        <button type="button" className="list-row" onClick={() => setPanel('fixed')}>
          <span className="ico"><Icon name="calendar" /></span>
          <span>
            <b>Costuri fixe lunare</b>
            <span className="sub" style={{ display: 'block' }}>RCA, leasing, licență, telefon…</span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
      </div>

      <p className="section-label">Date</p>
      <div className="list">
        <button type="button" className="list-row" onClick={() => onOpenData('backup')}>
          <span className="ico"><Icon name="box" /></span>
          <span>
            <b>Backup</b>
            <span className="sub" style={{ display: 'block' }}>
              Ultimul: {settings.lastBackupAt ? formatDistanceToNow(settings.lastBackupAt, { locale: ro, addSuffix: true }) : 'niciodată'}
            </span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        <button type="button" className="list-row" onClick={() => onOpenData('restore')}>
          <span className="ico"><Icon name="upload" /></span>
          <span><b>Restaurează din backup</b></span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        <button type="button" className="list-row" onClick={() => onOpenData('export')}>
          <span className="ico"><Icon name="download" /></span>
          <span>
            <b>Exportă rapoarte</b>
            <span className="sub" style={{ display: 'block' }}>PDF sau CSV, pe orice perioadă</span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        <button type="button" className="list-row" onClick={() => onOpenData('trash')}>
          <span className="ico"><Icon name="trash" /></span>
          <span>
            <b>Coș</b>
            <span className="sub" style={{ display: 'block' }}>Curse și cheltuieli șterse în ultimele 30 de zile</span>
          </span>
          <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
        </button>
        {restorePoint && (
          <button type="button" className="list-row" onClick={async () => { await undoLastRestore(); toast('Restaurarea a fost anulată'); }}>
            <span className="ico"><Icon name="undo" /></span>
            <span>
              <b>Anulează ultima restaurare</b>
              <span className="sub" style={{ display: 'block' }}>Revino la datele din {format(restorePoint.createdAt, 'd MMM, HH:mm', { locale: ro })}</span>
            </span>
            <span />
          </button>
        )}
      </div>

      {isAndroidApp() && <LiveReaderSection />}

      <p className="section-label">Aspect</p>
      <div className="stack">
        <Segmented<ThemePreference>
          label="Temă"
          value={settings.theme}
          onChange={(theme) => void updateSettings({ theme })}
          options={[
            { value: 'system', label: 'Sistem' },
            { value: 'light', label: 'Luminos' },
            { value: 'dark', label: 'Întunecat' },
          ]}
        />
        <SelectField
          label="Monedă (doar afișare, fără conversie)"
          value={settings.currency}
          onChange={(currency) => void updateSettings({ currency })}
          options={CURRENCIES.map((x) => ({ value: x, label: x }))}
        />
      </div>

      <p className="small muted" style={{ margin: '24px 4px 0' }}>
        Datele stau doar pe acest telefon. Drivio nu trimite nimic pe internet.
      </p>

      {editing && (
        <Sheet
          title={editing === 'new' ? 'Vehicul nou' : editing.name}
          onClose={() => setEditing(null)}
        >
          <VehicleForm
            vehicle={editing === 'new' ? undefined : editing}
            currency={c}
            submitLabel="Salvează vehiculul"
            onSaved={(v) => {
              toast('Vehicul salvat');
              if (!settings.activeVehicleId) void updateSettings({ activeVehicleId: v.id });
              setEditing(null);
            }}
          />
          {editing !== 'new' && (
            <div className="grid-2" style={{ marginTop: 12 }}>
              {editing.id !== settings.activeVehicleId && !editing.archived ? (
                <button type="button" className="btn" onClick={() => { void updateSettings({ activeVehicleId: editing.id }); toast(`${editing.name} e vehiculul activ`); setEditing(null); }}>
                  Folosește-l acum
                </button>
              ) : (
                <span />
              )}
              {editing.archived ? (
                <button type="button" className="btn" onClick={() => { void setVehicleArchived(editing.id, false); setEditing(null); }}>
                  Scoate din arhivă
                </button>
              ) : (
                editing.id !== settings.activeVehicleId && (
                  <button type="button" className="btn btn-danger" onClick={() => { void setVehicleArchived(editing.id, true); toast('Vehicul arhivat'); setEditing(null); }}>
                    Arhivează
                  </button>
                )
              )}
            </div>
          )}
          {editing !== 'new' && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Modificările se aplică doar curselor noi. Cursele salvate își păstrează costurile de atunci.
            </p>
          )}
        </Sheet>
      )}

      {panel === 'goals' && <GoalsSheet settings={settings} onClose={() => setPanel(null)} />}
      {panel === 'fixed' && <FixedCostsSheet settings={settings} onClose={() => setPanel(null)} />}

      {financialOpen && (
        <Sheet title="Comisioane și praguri" onClose={() => setFinancialOpen(false)}>
          <FinancialForm
            initial={{ commissionPct: settings.commissionPct, thresholds: settings.thresholds, fareModeByPlatform: settings.fareModeByPlatform }}
            currency={c}
            submitLabel="Salvează"
            onSubmit={async (f) => {
              await updateSettings({ commissionPct: f.commissionPct, thresholds: f.thresholds, fareModeByPlatform: f.fareModeByPlatform });
              toast('Setări salvate');
              setFinancialOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
