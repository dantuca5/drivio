import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { dayKey, evaluateVerdict, isInRange, resolvePeriod, type DateRange } from '../../domain';
import { defaultRideFilter, filterRides, type RideFilter, type RideSort } from '../../features/historyFilter';
import { useNow, useVehicles } from '../../features/hooks';
import { db } from '../../services/db';
import type { AppSettings, ExpenseEntity, RideEntity } from '../../services/entities';
import { EmptyState, Segmented, SelectField } from '../components/controls';
import { Icon } from '../components/Icon';
import { amount, dayTitle, perHour, time } from '../format';
import { ExpenseSheet } from '../sheets/FinanceSheets';
import { EXPENSE_LABEL, PLATFORM_LABEL, VERDICT_WORD } from '../text';

type PeriodChoice = 'all' | 'last7' | 'last30' | 'thisMonth';
const PAGE = 100;

export function HistoryScreen({ settings, onOpenRide }: { settings: AppSettings; onOpenRide: (r: RideEntity) => void }) {
  const [view, setView] = useState<'rides' | 'expenses'>('rides');
  return (
    <>
      <Segmented
        label="Ce vezi"
        value={view}
        onChange={setView}
        options={[
          { value: 'rides', label: 'Curse' },
          { value: 'expenses', label: 'Cheltuieli' },
        ]}
      />
      {view === 'rides' ? <RidesList settings={settings} onOpenRide={onOpenRide} /> : <ExpensesList settings={settings} />}
    </>
  );
}

function usePeriodRange(choice: PeriodChoice): DateRange | null {
  const now = useNow();
  const day = now.toDateString();
  return useMemo(() => (choice === 'all' ? null : resolvePeriod({ kind: choice }, now)), [choice, day]);
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Oricând' },
  { value: 'last7', label: 'Ultimele 7 zile' },
  { value: 'last30', label: 'Ultimele 30 de zile' },
  { value: 'thisMonth', label: 'Luna curentă' },
] as const;

const SORT_OPTIONS: { value: RideSort; label: string }[] = [
  { value: 'newest', label: 'Cele mai noi' },
  { value: 'oldest', label: 'Cele mai vechi' },
  { value: 'profitDesc', label: 'Profit, descrescător' },
  { value: 'perHourDesc', label: 'Profit pe oră, descrescător' },
  { value: 'perHourAsc', label: 'Profit pe oră, crescător' },
  { value: 'perKmDesc', label: 'Profit pe km, descrescător' },
];

function RidesList({ settings, onOpenRide }: { settings: AppSettings; onOpenRide: (r: RideEntity) => void }) {
  const all = useLiveQuery(() => db.rides.orderBy('startedAt').reverse().filter((r) => r.deletedAt === null).toArray(), []);
  const vehicles = useVehicles(true);
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>('all');
  const range = usePeriodRange(periodChoice);
  const [f, setF] = useState<Omit<RideFilter, 'range'>>(defaultRideFilter);
  const [page, setPage] = useState(PAGE);
  const c = settings.currency;

  const names = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v.name])), [vehicles]);
  const filtered = useMemo(() => (all ? filterRides(all, { ...f, range }, settings.thresholds, names) : []), [all, f, range, settings.thresholds, names]);
  const shown = filtered.slice(0, page);
  const top = f.limit !== null;
  const set = (patch: Partial<RideFilter>) => { setF((s) => ({ ...s, ...patch })); setPage(PAGE); };

  const groups = useMemo(() => {
    if (f.sort !== 'newest' && f.sort !== 'oldest') return null;
    const map = new Map<string, RideEntity[]>();
    for (const r of shown) map.set(dayKey(r.startedAt), [...(map.get(dayKey(r.startedAt)) ?? []), r]);
    return [...map.values()];
  }, [shown, f.sort]);

  if (all && all.length === 0) {
    return (
      <EmptyState title="Nicio cursă salvată">
        <p>Cursele pe care le salvezi apar aici, grupate pe zile.</p>
      </EmptyState>
    );
  }

  const row = (r: RideEntity, withDate: boolean) => {
    const v = evaluateVerdict(r.result, settings.thresholds);
    return (
      <button key={r.id} type="button" className="ride-row" onClick={() => onOpenRide(r)}>
        <span className={`dot dot-${v.level}`} role="img" aria-label={VERDICT_WORD[v.level]} />
        <span style={{ minWidth: 0 }}>
          <span className="t">
            <span className="tag">{PLATFORM_LABEL[r.platform]}</span>
            <span className="num">{amount(r.result.grossIncomeMinor)} {c}</span>
          </span>
          <span className="m num" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {withDate ? format(r.startedAt, 'd MMM, HH:mm', { locale: ro }) : time(r.startedAt)} · {perHour(r.result.profitPerHour, c)}
            {r.note ? ` · ${r.note}` : ''}
          </span>
        </span>
        <span className="p">
          <b className="num">{amount(r.result.profitMinor)}</b>
          <span className="small muted">profit</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <label className="search-field" style={{ marginTop: 12 }}>
        <Icon name="search" />
        <span className="visually-hidden">Caută</span>
        <input type="search" value={f.query} placeholder="Caută: notă, sumă, dată (19.11)" onChange={(e) => set({ query: e.target.value })} enterKeyHint="search" />
      </label>
      <div className="filters" role="group" aria-label="Filtre" style={{ marginTop: 10 }}>
        {(['all', 'uber', 'bolt'] as const).map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={f.platform === p} onClick={() => set({ platform: p })}>
            {p === 'all' ? 'Toate' : PLATFORM_LABEL[p]}
          </button>
        ))}
        {(['go', 'slow', 'stop'] as const).map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={f.verdict === v} onClick={() => set({ verdict: f.verdict === v ? 'all' : v })}>
            <span className={`dot dot-${v}`} aria-hidden="true" /> {VERDICT_WORD[v]}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={top && f.sort === 'perHourDesc'} onClick={() => set(top && f.sort === 'perHourDesc' ? { sort: 'newest', limit: null } : { sort: 'perHourDesc', limit: 10 })}>
          Cele mai bune 10
        </button>
        <button type="button" className="chip" aria-pressed={top && f.sort === 'perHourAsc'} onClick={() => set(top && f.sort === 'perHourAsc' ? { sort: 'newest', limit: null } : { sort: 'perHourAsc', limit: 10 })}>
          Cele mai slabe 10
        </button>
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <SelectField label="Perioadă" value={periodChoice} onChange={(v) => { setPeriodChoice(v); setPage(PAGE); }} options={PERIOD_OPTIONS} />
        <SelectField label="Ordine" value={f.sort} onChange={(sort) => set({ sort })} options={SORT_OPTIONS} />
      </div>

      <p className="small muted" style={{ margin: '12px 2px 0' }} aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'cursă' : 'curse'} · profit {amount(filtered.reduce((s, r) => s + r.result.profitMinor, 0))} {c}
        {top && ' · după profitul pe oră'}
      </p>

      {filtered.length === 0 && all && <EmptyState title="Nicio cursă nu se potrivește">Schimbă filtrele sau căutarea.</EmptyState>}

      {groups
        ? groups.map((list) => (
            <section key={dayKey(list[0]!.startedAt)} aria-label={dayTitle(list[0]!.startedAt)}>
              <div className="day-head">
                <span>{dayTitle(list[0]!.startedAt)}</span>
                <span className="num">{amount(list.reduce((s, r) => s + r.result.profitMinor, 0))} {c}</span>
              </div>
              {list.map((r) => row(r, false))}
            </section>
          ))
        : <div style={{ marginTop: 8 }}>{shown.map((r) => row(r, true))}</div>}

      {filtered.length > page && (
        <button type="button" className="btn btn-block" style={{ marginTop: 16 }} onClick={() => setPage((p) => p + PAGE)}>
          Arată mai multe
        </button>
      )}
    </>
  );
}

function ExpensesList({ settings }: { settings: AppSettings }) {
  const all = useLiveQuery(() => db.expenses.orderBy('date').reverse().filter((e) => e.deletedAt === null).toArray(), []);
  const [periodChoice, setPeriodChoice] = useState<PeriodChoice>('thisMonth');
  const range = usePeriodRange(periodChoice);
  const [editing, setEditing] = useState<ExpenseEntity | 'new' | null>(null);
  const c = settings.currency;
  const list = (all ?? []).filter((e) => !range || isInRange(e.date, range));
  const counted = list.filter((e) => e.category !== 'fuel' && e.category !== 'charging').reduce((s, e) => s + e.amountMinor, 0);
  const energy = list.filter((e) => e.category === 'fuel' || e.category === 'charging').reduce((s, e) => s + e.amountMinor, 0);

  return (
    <>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <SelectField label="Perioadă" value={periodChoice} onChange={setPeriodChoice} options={PERIOD_OPTIONS} />
        <button type="button" className="btn btn-primary" style={{ height: 'auto' }} onClick={() => setEditing('new')}>
          Adaugă cheltuială
        </button>
      </div>
      <p className="small muted" style={{ margin: '12px 2px 4px' }}>
        Cheltuieli scăzute din profit: <b className="num">{amount(counted)} {c}</b>
        {energy > 0 && <> · bonuri energie (doar comparație): <b className="num">{amount(energy)} {c}</b></>}
      </p>
      {list.length === 0 ? (
        <EmptyState title="Nicio cheltuială în această perioadă">
          <p>Adaugă service, spălătorie, parcare, amenzi sau bonuri de combustibil și încărcare.</p>
        </EmptyState>
      ) : (
        list.map((e) => (
          <button key={e.id} type="button" className="ride-row" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => setEditing(e)}>
            <span style={{ minWidth: 0 }}>
              <span className="t">{EXPENSE_LABEL[e.category]}</span>
              <span className="m" style={{ display: 'block' }}>
                {format(e.date, 'd MMM yyyy', { locale: ro })}
                {e.note ? ` · ${e.note}` : ''}
                {(e.category === 'fuel' || e.category === 'charging') && ' · doar comparație'}
              </span>
            </span>
            <span className="p"><b className="num">{amount(e.amountMinor)}</b><span className="small muted">{c}</span></span>
          </button>
        ))
      )}
      {editing && <ExpenseSheet settings={settings} expense={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
