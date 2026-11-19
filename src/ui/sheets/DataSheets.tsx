import { format, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { isInRange, platformComparison, resolvePeriod, summarize, type PeriodSpec } from '../../domain';
import { useNow } from '../../features/hooks';
import { createBackupJson, getRestorePoint, markBackupDone, parseBackup, restoreBackup, undoLastRestore, BackupError, type ParsedBackup, type RestoreMode } from '../../services/backup';
import { db } from '../../services/db';
import type { AppSettings } from '../../services/entities';
import { expensesToCsv, ridesToCsv } from '../../services/exportCsv';
import { buildPdfReport, loadPdfFonts } from '../../services/exportPdf';
import { deleteForever, listTrash, restoreExpense, restoreRide, TRASH_DAYS } from '../../services/repositories';
import { shareOrDownload } from '../../services/share';
import { Segmented } from '../components/controls';
import { Icon } from '../components/Icon';
import { PeriodPicker, periodLabel } from '../components/PeriodPicker';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { amount, money } from '../format';
import { EXPENSE_LABEL, PLATFORM_LABEL } from '../text';

/**
 * Fișierele se pregătesc într-un pas separat de salvare: pe iPhone, foaia de partajare
 * trebuie deschisă direct din apăsarea unui buton, nu după o operație lungă.
 */
function ReadyFile({ file, onSaved }: { file: File; onSaved?: () => void }) {
  const toast = useToast();
  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <div className="row">
        <span>
          <b>{file.name}</b>
          <span className="small muted" style={{ display: 'block' }}>{(file.size / 1024).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} KB · gata de salvat</span>
        </span>
        <Icon name="check" width={22} height={22} />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        onClick={async () => {
          const outcome = await shareOrDownload(file);
          if (outcome === 'cancelled') return;
          toast(outcome === 'shared' ? 'Fișier trimis' : 'Fișier descărcat');
          onSaved?.();
        }}
      >
        Salvează fișierul
      </button>
      <p className="small muted" style={{ marginTop: 8 }}>Pe iPhone alege „Salvează în Fișiere” (de preferat în iCloud Drive) sau trimite-l pe e-mail.</p>
    </div>
  );
}

const stamp = (d: Date) => format(d, 'yyyy-MM-dd');

// ---------- Export ----------

type ExportKind = 'pdf' | 'ridesCsv' | 'expensesCsv';

export function ExportSheet({ settings, initialPeriod, onClose }: { settings: AppSettings; initialPeriod?: PeriodSpec; onClose: () => void }) {
  const now = useNow();
  const [period, setPeriod] = useState<PeriodSpec>(initialPeriod ?? { kind: 'thisMonth' });
  const [kind, setKind] = useState<ExportKind>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    setBusy(true);
    setError(null);
    setFile(null);
    try {
      const range = resolvePeriod(period, now);
      const [allRides, allExpenses, fixedCosts, vehicles] = await Promise.all([
        db.rides.where('startedAt').between(range.start, range.end, true, false).toArray(),
        db.expenses.toArray(),
        db.fixedCosts.toArray(),
        db.vehicles.toArray(),
      ]);
      const rides = allRides.filter((r) => r.deletedAt === null);
      const expenses = allExpenses.filter((e) => e.deletedAt === null && isInRange(e.date, range));
      const suffix = `${stamp(range.start)}_${stamp(new Date(range.end.getTime() - 1))}`;
      if (kind === 'ridesCsv') {
        setFile(new File([ridesToCsv(rides, vehicles, settings.thresholds, settings.currency)], `drivio-curse-${suffix}.csv`, { type: 'text/csv' }));
      } else if (kind === 'expensesCsv') {
        setFile(new File([expensesToCsv(expenses, EXPENSE_LABEL, settings.currency)], `drivio-cheltuieli-${suffix}.csv`, { type: 'text/csv' }));
      } else {
        const blob = await buildPdfReport(
          {
            title: 'Raport Drivio',
            periodLabel: periodLabel(period, range),
            currency: settings.currency,
            generatedAt: new Date(),
            summary: summarize({ rides, expenses: allExpenses.filter((e) => e.deletedAt === null), fixedCosts, range, now, taxReservePct: settings.taxReservePct }),
            platforms: platformComparison(rides),
            rides,
            expenses,
            expenseLabels: EXPENSE_LABEL,
          },
          await loadPdfFonts(),
        );
        setFile(new File([blob], `drivio-raport-${suffix}.pdf`, { type: 'application/pdf' }));
      }
    } catch (e) {
      setError(e instanceof Error ? `Exportul nu a reușit: ${e.message}` : 'Exportul nu a reușit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Exportă" onClose={onClose}>
      <div className="stack">
        <PeriodPicker value={period} onChange={(p) => { setPeriod(p); setFile(null); }} now={now} />
        <p className="small muted">{periodLabel(period, resolvePeriod(period, now))}</p>
        <Segmented
          label="Format"
          value={kind}
          onChange={(k) => { setKind(k); setFile(null); }}
          options={[
            { value: 'pdf', label: 'Raport PDF' },
            { value: 'ridesCsv', label: 'Curse CSV' },
            { value: 'expensesCsv', label: 'Cheltuieli CSV' },
          ]}
        />
        <p className="small muted">
          {kind === 'pdf' ? 'Rezumatul perioadei, Uber vs Bolt, lista curselor și a cheltuielilor.' : 'Se deschide în Excel sau Numbers (separator „;”, virgulă zecimală).'}
        </p>
        <button type="button" className="btn btn-block" disabled={busy} onClick={() => void prepare()}>
          {busy ? 'Se pregătește…' : 'Pregătește fișierul'}
        </button>
        {error && <p className="field-error" role="alert">{error}</p>}
        {file && <ReadyFile file={file} />}
      </div>
    </Sheet>
  );
}

// ---------- Backup ----------

export function BackupSheet({ settings, onClose }: { settings: AppSettings; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title="Backup" onClose={onClose}>
      <p className="muted">
        Un fișier cu toate datele: vehicule, curse, cheltuieli, costuri fixe și setări. Păstrează-l în iCloud Drive sau trimite-l pe e-mail, ca să nu pierzi nimic dacă schimbi telefonul sau ștergi aplicația.
      </p>
      <p className="small muted" style={{ marginTop: 8 }}>
        Ultimul backup: {settings.lastBackupAt ? formatDistanceToNow(settings.lastBackupAt, { locale: ro, addSuffix: true }) : 'niciodată'}
      </p>
      <button
        type="button"
        className="btn btn-block"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const now = new Date();
            const { json, counts } = await createBackupJson(now);
            setFile(new File([json], `drivio-backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`, { type: 'application/json' }));
            setInfo(`${counts.rides} curse, ${counts.expenses} cheltuieli, ${counts.vehicles} vehicule, ${counts.fixedCosts} costuri fixe`);
          } catch {
            setError('Backup-ul nu a putut fi creat. Încearcă din nou.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Se pregătește…' : 'Pregătește backup-ul'}
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
      {file && (
        <>
          <p className="small muted" style={{ marginTop: 10 }}>Conține: {info}.</p>
          <ReadyFile file={file} onSaved={() => void markBackupDone()} />
        </>
      )}
    </Sheet>
  );
}

// ---------- Restaurare ----------

export function RestoreSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [mode, setMode] = useState<RestoreMode>('replace');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function onFile(f: File | undefined) {
    setParsed(null);
    setError(null);
    setConfirming(false);
    if (!f) return;
    try {
      setParsed(await parseBackup(await f.text()));
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Fișierul nu a putut fi citit.');
    }
  }

  async function restore() {
    if (!parsed) return;
    setBusy(true);
    try {
      await restoreBackup(parsed, mode);
      toast('Backup restaurat', { actionLabel: 'Anulează', duration: 8000, onAction: () => void undoLastRestore().then(() => toast('Restaurarea a fost anulată')) });
      onClose();
    } catch {
      setError('Restaurarea nu a reușit. Datele de pe telefon au rămas neschimbate.');
    } finally {
      setBusy(false);
    }
  }

  const d = (x: Date | null) => (x ? format(x, 'd MMM yyyy', { locale: ro }) : '—');

  return (
    <Sheet title="Restaurează din backup" onClose={onClose}>
      <input ref={input} type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <button type="button" className="btn btn-block" onClick={() => input.current?.click()}>
        Alege fișierul de backup
      </button>
      {error && <p className="field-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {parsed && (
        <>
          <div className="panel" style={{ marginTop: 14 }}>
            <p className="panel-title">Fișier verificat</p>
            <div className="kv"><span>Creat</span><b>{format(parsed.exportedAt, 'd MMM yyyy, HH:mm', { locale: ro })}</b></div>
            <div className="kv"><span>Curse</span><b className="num">{parsed.counts.rides}</b></div>
            <div className="kv"><span>Perioadă curse</span><b>{d(parsed.firstRide)} – {d(parsed.lastRide)}</b></div>
            <div className="kv"><span>Cheltuieli</span><b className="num">{parsed.counts.expenses}</b></div>
            <div className="kv"><span>Vehicule</span><b className="num">{parsed.counts.vehicles}</b></div>
            <div className="kv"><span>Costuri fixe</span><b className="num">{parsed.counts.fixedCosts}</b></div>
          </div>
          <Segmented
            className=""
            label="Mod de restaurare"
            value={mode}
            onChange={(m) => { setMode(m); setConfirming(false); }}
            options={[
              { value: 'replace', label: 'Înlocuiește tot' },
              { value: 'merge', label: 'Adaugă la datele actuale' },
            ]}
          />
          <p className="small muted" style={{ marginTop: 8 }}>
            {mode === 'replace'
              ? 'Datele de pe telefon vor fi înlocuite cu cele din fișier, inclusiv setările.'
              : 'Cursele și cheltuielile din fișier se adaugă; cele care există deja se actualizează. Setările tale rămân.'}{' '}
            Înainte de restaurare se salvează automat o copie a datelor actuale, ca să poți anula.
          </p>
          <button type="button" className={`btn btn-block ${confirming ? 'btn-primary' : ''}`} style={{ marginTop: 12 }} disabled={busy} onClick={() => (confirming ? void restore() : setConfirming(true))}>
            {confirming ? 'Confirmă restaurarea' : 'Restaurează'}
          </button>
        </>
      )}
    </Sheet>
  );
}

export function useRestorePoint() {
  return useLiveQuery(() => getRestorePoint(), []);
}

// ---------- Coș ----------

export function TrashSheet({ settings, onClose }: { settings: AppSettings; onClose: () => void }) {
  const toast = useToast();
  const trash = useLiveQuery(() => listTrash(), []);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const c = settings.currency;
  const empty = trash && trash.rides.length === 0 && trash.expenses.length === 0;

  const row = (kind: 'ride' | 'expense', id: string, title: string, sub: string, deletedAt: Date) => (
    <div key={id} className="list-row" style={{ gridTemplateColumns: '1fr auto' }}>
      <span>
        <b>{title}</b>
        <span className="sub" style={{ display: 'block' }}>
          {sub} · ștearsă {formatDistanceToNow(deletedAt, { locale: ro, addSuffix: true })}
        </span>
      </span>
      <span className="row" style={{ gap: 6 }}>
        <button type="button" className="btn btn-small" onClick={() => { void (kind === 'ride' ? restoreRide(id) : restoreExpense(id)); toast('Restaurat'); }}>
          Restaurează
        </button>
        <button
          type="button"
          className="btn btn-small btn-danger"
          aria-label={confirmId === id ? 'Confirmă ștergerea definitivă' : 'Șterge definitiv'}
          onClick={() => {
            if (confirmId !== id) return setConfirmId(id);
            void deleteForever(kind, id);
            setConfirmId(null);
          }}
        >
          {confirmId === id ? 'Sigur?' : <Icon name="trash" width={16} height={16} />}
        </button>
      </span>
    </div>
  );

  return (
    <Sheet title="Coș" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>Elementele șterse stau aici {TRASH_DAYS} de zile, apoi se șterg definitiv.</p>
      {empty && <p className="empty">Coșul e gol.</p>}
      {trash && trash.rides.length > 0 && (
        <>
          <p className="section-label" style={{ marginTop: 0 }}>Curse</p>
          <div className="list">
            {trash.rides.map((r) => row('ride', r.id, `${PLATFORM_LABEL[r.platform]} · ${money(r.result.grossIncomeMinor, c)}`, `${format(r.startedAt, 'd MMM, HH:mm', { locale: ro })} · profit ${amount(r.result.profitMinor)}`, r.deletedAt!))}
          </div>
        </>
      )}
      {trash && trash.expenses.length > 0 && (
        <>
          <p className="section-label">Cheltuieli</p>
          <div className="list">
            {trash.expenses.map((e) => row('expense', e.id, `${EXPENSE_LABEL[e.category]} · ${money(e.amountMinor, c)}`, format(e.date, 'd MMM yyyy', { locale: ro }), e.deletedAt!))}
          </div>
        </>
      )}
    </Sheet>
  );
}
