import { useMemo, useState } from 'react';
import {
  buildCostSnapshot,
  formatNumber,
  minFarePerPaidKm,
  minGrossPerHour,
  parseDecimal,
  platformComparison,
  PLATFORMS,
  resolvePeriod,
  type Platform,
} from '../../domain';
import { emptyRideForm, liveCalculation, parseRideForm, type RideFormValues } from '../../features/rideForm';
import { useNow, useRidesInRange, useVehicles } from '../../features/hooks';
import type { AppSettings, VehicleEntity } from '../../services/entities';
import { Icon, type IconName } from '../components/Icon';
import { NumberField, Segmented } from '../components/controls';
import { Sheet } from '../components/Sheet';
import { amount, pct, perHour, perKm } from '../format';
import { PLATFORM_LABEL, VERDICT_WORD } from '../text';

type Tool = 'compare' | 'minKm' | 'minHour' | 'platforms';

const TOOLS: { id: Tool | 'simulate'; icon: IconName; title: string; sub: string }[] = [
  { id: 'simulate', icon: 'play', title: 'Simulează o cursă', sub: 'Verifică o ofertă înainte s-o accepți' },
  { id: 'compare', icon: 'scale', title: 'Compară două curse', sub: 'Care aduce mai mult pe oră și pe km' },
  { id: 'minKm', icon: 'route', title: 'Tarif minim pe km', sub: 'Sub ce sumă pe km nu merită' },
  { id: 'minHour', icon: 'clock', title: 'Încasare minimă pe oră', sub: 'Cât trebuie să încasezi pe oră' },
  { id: 'platforms', icon: 'percent', title: 'Uber vs Bolt', sub: 'Comparație pe perioada aleasă' },
];

export function ToolsScreen({ settings, onSimulate }: { settings: AppSettings; onSimulate: () => void }) {
  const [open, setOpen] = useState<Tool | null>(null);
  const vehicles = useVehicles();
  const vehicle = vehicles?.find((v) => v.id === settings.activeVehicleId) ?? vehicles?.[0];

  return (
    <>
      <div className="list">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="list-row" onClick={() => (t.id === 'simulate' ? onSimulate() : setOpen(t.id))}>
            <span className="ico"><Icon name={t.icon} /></span>
            <span>
              <b>{t.title}</b>
              <span className="sub" style={{ display: 'block' }}>{t.sub}</span>
            </span>
            <span className="end"><Icon name="chevronRight" width={18} height={18} /></span>
          </button>
        ))}
      </div>
      {open === 'compare' && vehicle && <CompareSheet settings={settings} vehicle={vehicle} onClose={() => setOpen(null)} />}
      {open === 'minKm' && vehicle && <MinKmSheet settings={settings} vehicle={vehicle} onClose={() => setOpen(null)} />}
      {open === 'minHour' && vehicle && <MinHourSheet settings={settings} vehicle={vehicle} onClose={() => setOpen(null)} />}
      {open === 'platforms' && <PlatformsSheet settings={settings} onClose={() => setOpen(null)} />}
    </>
  );
}

interface ToolProps {
  settings: AppSettings;
  vehicle: VehicleEntity;
  onClose: () => void;
}

function costPerKmOf(vehicle: VehicleEntity) {
  const s = buildCostSnapshot(vehicle, 0);
  return s.energyCostPerKm + s.wearCostPerKm;
}

/* ---------- Compară două curse ---------- */

function useMiniRide(settings: AppSettings, vehicle: VehicleEntity, platform: Platform, values: RideFormValues) {
  return useMemo(() => {
    const commission = settings.commissionPct[platform];
    const base = buildCostSnapshot(vehicle, commission);
    return liveCalculation(parseRideForm(values), { ...base, platformCommissionPct: commission }, settings.thresholds);
  }, [settings, vehicle, platform, values]);
}

function CompareColumn({ label, platform, setPlatform, values, setValues }: {
  label: string;
  platform: Platform;
  setPlatform: (p: Platform) => void;
  values: RideFormValues;
  setValues: (fn: (v: RideFormValues) => RideFormValues) => void;
}) {
  const set = (k: keyof RideFormValues) => (val: string) => setValues((s) => ({ ...s, [k]: val }));
  return (
    <div className="compare-col stack">
      <h3>{label}</h3>
      <Segmented label={`Platformă ${label}`} value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))} />
      <NumberField label="Sumă" value={values.fare} onChange={set('fare')} />
      <NumberField label="Km cu client" value={values.tripKm} onChange={set('tripKm')} />
      <NumberField label="Minute cursă" mode="numeric" value={values.tripMin} onChange={set('tripMin')} />
      <NumberField label="Km până la client" value={values.pickupKm} onChange={set('pickupKm')} />
      <NumberField label="Minute preluare" mode="numeric" value={values.pickupMin} onChange={set('pickupMin')} />
    </div>
  );
}

function CompareSheet({ settings, vehicle, onClose }: ToolProps) {
  const [pa, setPa] = useState<Platform>(settings.lastPlatform);
  const [pb, setPb] = useState<Platform>(settings.lastPlatform);
  const [a, setA] = useState<RideFormValues>(emptyRideForm);
  const [b, setB] = useState<RideFormValues>(emptyRideForm);
  const ra = useMiniRide(settings, vehicle, pa, a);
  const rb = useMiniRide(settings, vehicle, pb, b);
  const c = settings.currency;

  let summary = 'Completează ambele curse.';
  if (ra && rb) {
    const ha = ra.result.profitPerHour;
    const hb = rb.result.profitPerHour;
    if (ha !== null && hb !== null && Math.abs(ha - hb) >= 0.005) {
      const better = hb > ha ? 'B' : 'A';
      summary = `Cursa ${better} aduce cu ${formatNumber(Math.abs(hb - ha))} ${c}/oră mai mult.`;
    } else {
      const d = rb.result.profitMinor - ra.result.profitMinor;
      summary = d === 0 ? 'Cele două curse sunt la fel de profitabile.' : `Cursa ${d > 0 ? 'B' : 'A'} aduce cu ${amount(Math.abs(d))} ${c} mai mult profit.`;
    }
  }

  const row = (label: string, fa: string, fb: string) => (
    <div className="row small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted" style={{ flex: 1 }}>{label}</span>
      <b className="num" style={{ width: '30%', textAlign: 'right' }}>{fa}</b>
      <b className="num" style={{ width: '30%', textAlign: 'right' }}>{fb}</b>
    </div>
  );

  return (
    <Sheet title="Compară două curse" onClose={onClose}>
      {/* rezultatul sus, ca să se vadă pe telefon în timp ce completezi câmpurile */}
      <div className="panel" style={{ marginBottom: 16 }} aria-live="polite">
        <p className="panel-title">{summary}</p>
        {row('', 'A', 'B')}
        {row('Verdict', ra ? VERDICT_WORD[ra.verdict.level] : '—', rb ? VERDICT_WORD[rb.verdict.level] : '—')}
        {row('Profit', ra ? amount(ra.result.profitMinor) : '—', rb ? amount(rb.result.profitMinor) : '—')}
        {row(`${c}/oră`, ra ? formatNumber(ra.result.profitPerHour) : '—', rb ? formatNumber(rb.result.profitPerHour) : '—')}
        {row(`${c}/km`, ra ? formatNumber(ra.result.profitPerKm) : '—', rb ? formatNumber(rb.result.profitPerKm) : '—')}
        {row('Randament', ra ? pct(ra.result.yieldPct) : '—', rb ? pct(rb.result.yieldPct) : '—')}
      </div>
      <div className="compare">
        <CompareColumn label="A" platform={pa} setPlatform={setPa} values={a} setValues={setA} />
        <CompareColumn label="B" platform={pb} setPlatform={setPb} values={b} setValues={setB} />
      </div>
    </Sheet>
  );
}

/* ---------- Tarif minim pe km ---------- */

const n = (s: string) => (s.trim() === '' ? null : parseDecimal(s));

function MinKmSheet({ settings, vehicle, onClose }: ToolProps) {
  const [platform, setPlatform] = useState<Platform>(settings.lastPlatform);
  const [v, setV] = useState({ target: '', speed: '', empty: '', fixed: '' });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const cost = costPerKmOf(vehicle);
  const c = settings.currency;

  const target = n(v.target);
  const speed = n(v.speed);
  const empty = n(v.empty) ?? 0;
  const fixed = n(v.fixed) ?? 0;
  let result: number | null = null;
  let error: string | null = null;
  if (target !== null && speed !== null) {
    if (target < 0 || speed < 0 || empty < 0 || fixed < 0) error = 'Valorile nu pot fi negative.';
    else if (empty >= 100) error = 'Procentul de km fără client trebuie să fie sub 100.';
    else result = minFarePerPaidKm({ costPerKm: cost, targetProfitPerHour: target, avgSpeedKmh: speed, emptyKmPct: empty, commissionPct: settings.commissionPct[platform], fixedCostPerHour: fixed });
  }

  return (
    <Sheet title="Tarif minim pe km" onClose={onClose}>
      <div className="stack">
        <Segmented label="Platformă" value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p, label: `${PLATFORM_LABEL[p]} · ${formatNumber(settings.commissionPct[p], 1)}%` }))} />
        <div className="grid-2">
          <NumberField label="Profit dorit pe oră" unit={`${c}/oră`} value={v.target} onChange={set('target')} />
          <NumberField label="Viteză medie" unit="km/h" value={v.speed} onChange={set('speed')} hint="Cu mașina în mișcare" />
          <NumberField label="Km fără client" unit="% din total" value={v.empty} onChange={set('empty')} hint="Drumuri până la client" />
          <NumberField label="Costuri fixe (opțional)" unit={`${c}/oră`} value={v.fixed} onChange={set('fixed')} />
        </div>
        <div className="panel" aria-live="polite">
          <div className="result-line" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
            <span className="muted">Acceptă curse de la</span>
            <b className="num">{result === null ? '—' : perKm(result, c)}</b>
          </div>
          {error && <p className="field-error">{error}</p>}
          <p className="small muted" style={{ marginTop: 8 }}>
            Pe km cu client, înainte de comision. Costul mașinii {vehicle.name}: {perKm(cost, c)}. Platformele plătesc și pe minut, deci folosește rezultatul ca reper.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Încasare minimă pe oră ---------- */

function MinHourSheet({ settings, vehicle, onClose }: ToolProps) {
  const [platform, setPlatform] = useState<Platform>(settings.lastPlatform);
  const [v, setV] = useState({ target: '', kmh: '', paid: '', fixed: '' });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const cost = costPerKmOf(vehicle);
  const c = settings.currency;
  const target = n(v.target);
  const kmh = n(v.kmh);
  const paid = n(v.paid);
  const fixed = n(v.fixed) ?? 0;
  const valid = target !== null && kmh !== null && target >= 0 && kmh >= 0 && fixed >= 0 && (paid === null || paid >= 0);
  const r = valid
    ? minGrossPerHour({ costPerKm: cost, targetProfitPerHour: target, kmPerWorkHour: kmh, commissionPct: settings.commissionPct[platform], fixedCostPerHour: fixed, ...(paid !== null ? { paidTimePct: paid } : {}) })
    : null;

  return (
    <Sheet title="Încasare minimă pe oră" onClose={onClose}>
      <div className="stack">
        <Segmented label="Platformă" value={platform} onChange={setPlatform} options={PLATFORMS.map((p) => ({ value: p, label: `${PLATFORM_LABEL[p]} · ${formatNumber(settings.commissionPct[p], 1)}%` }))} />
        <div className="grid-2">
          <NumberField label="Profit dorit pe oră" unit={`${c}/oră`} value={v.target} onChange={set('target')} />
          <NumberField label="Km pe oră de lucru" unit="km" value={v.kmh} onChange={set('kmh')} hint="Cu și fără client" />
          <NumberField label="Timp cu client (opțional)" unit="%" value={v.paid} onChange={set('paid')} />
          <NumberField label="Costuri fixe (opțional)" unit={`${c}/oră`} value={v.fixed} onChange={set('fixed')} />
        </div>
        <div className="panel" aria-live="polite">
          <div className="row"><span className="muted">Pe oră de lucru</span><b className="num">{r ? perHour(r.perWorkHour, c) : '—'}</b></div>
          <div className="result-line"><span className="muted">Pe oră cu client</span><b className="num">{r?.perPaidHour != null ? perHour(r.perPaidHour, c) : '—'}</b></div>
          <p className="small muted" style={{ marginTop: 8 }}>Încasare brută, înainte de comision. Cost mașină: {perKm(cost, c)}.</p>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Uber vs Bolt ---------- */

function PlatformsSheet({ settings, onClose }: { settings: AppSettings; onClose: () => void }) {
  const now = useNow();
  const [period, setPeriod] = useState<'last7' | 'last30' | 'thisMonth'>('last30');
  const day = now.toDateString(); // intervalul se recalculează doar când se schimbă ziua
  const range = useMemo(() => resolvePeriod({ kind: period }, now), [period, day]);
  const rides = useRidesInRange(range);
  const stats = rides ? platformComparison(rides) : null;
  const c = settings.currency;
  const rows: [string, (p: Platform) => string][] = [
    ['Curse', (p) => String(stats![p].rideCount)],
    ['Profit', (p) => amount(stats![p].profitMinor)],
    [`${c}/oră`, (p) => formatNumber(stats![p].profitPerHour)],
    [`${c}/km`, (p) => formatNumber(stats![p].profitPerKm)],
    ['Comision mediu', (p) => pct(stats![p].avgCommissionPct, 1)],
  ];
  return (
    <Sheet title="Uber vs Bolt" onClose={onClose}>
      <Segmented label="Perioadă" value={period} onChange={setPeriod} options={[{ value: 'last7', label: '7 zile' }, { value: 'last30', label: '30 zile' }, { value: 'thisMonth', label: 'Luna' }]} />
      {stats && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="row small" style={{ paddingBottom: 6 }}>
            <span style={{ flex: 1 }} />
            {PLATFORMS.map((p) => <b key={p} style={{ width: '30%', textAlign: 'right' }}>{PLATFORM_LABEL[p]}</b>)}
          </div>
          {rows.map(([label, f]) => (
            <div key={label} className="row small" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span className="muted" style={{ flex: 1 }}>{label}</span>
              {PLATFORMS.map((p) => <b key={p} className="num" style={{ width: '30%', textAlign: 'right' }}>{f(p)}</b>)}
            </div>
          ))}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Profitul pe oră folosește timpul curselor, inclusiv preluarea și așteptarea.</p>
    </Sheet>
  );
}
