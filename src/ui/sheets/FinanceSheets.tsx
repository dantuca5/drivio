import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { EXPENSE_CATEGORIES, fromMinor, goalsSchema, parseDecimal, parseMoney, taxReservePctSchema, toMinor, type ExpenseCategory } from '../../domain';
import { useVehicles } from '../../features/hooks';
import { db } from '../../services/db';
import type { AppSettings, ExpenseEntity, FixedCostEntity } from '../../services/entities';
import { deleteFixedCost, restoreExpense, saveExpense, saveFixedCost, softDeleteExpense, stopFixedCost, updateSettings, ValidationError } from '../../services/repositories';
import { NumberField, SelectField, TextField } from '../components/controls';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { amount, money, toField } from '../format';
import { EXPENSE_LABEL } from '../text';

const moneyField = (minor: number | null | undefined) => (minor === null || minor === undefined ? '' : toField(fromMinor(minor)));

/** Sumă în lei din text; mesaj clar dacă lipsește sau are prea multe zecimale. */
function readMoney(text: string, emptyMessage: string): { value: number | null; error?: string } {
  if (text.trim() === '') return { value: null, error: emptyMessage };
  const v = parseMoney(text);
  if (v !== null) return { value: v };
  return { value: null, error: parseDecimal(text) === null ? 'Număr invalid.' : 'Suma poate avea cel mult 2 zecimale.' };
}
const dayInput = (d: Date) => format(d, 'yyyy-MM-dd');
const parseDay = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// ---------- Cheltuială ----------

export function ExpenseSheet({ settings, expense, onClose }: { settings: AppSettings; expense?: ExpenseEntity; onClose: () => void }) {
  const toast = useToast();
  const vehicles = useVehicles();
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'service');
  const [amountText, setAmount] = useState(moneyField(expense?.amountMinor));
  const [date, setDate] = useState(dayInput(expense?.date ?? new Date()));
  const [vehicleId, setVehicleId] = useState(expense?.vehicleId ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const c = settings.currency;
  const isEnergy = category === 'fuel' || category === 'charging';

  async function save() {
    const { value, error } = readMoney(amountText, 'Introdu suma.');
    const day = parseDay(date);
    const errs: Record<string, string> = {};
    if (error) errs.amountMinor = error;
    if (!day) errs.date = 'Alege data.';
    if (Object.keys(errs).length) return setErrors(errs);
    try {
      // ora 12:00 evită ambiguitățile la schimbarea orei
      await saveExpense({ date: new Date(day!.getFullYear(), day!.getMonth(), day!.getDate(), 12), category, amountMinor: toMinor(value!), vehicleId: vehicleId || undefined, note }, expense?.id);
      toast(expense ? 'Cheltuială actualizată' : 'Cheltuială salvată');
      onClose();
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.fieldErrors : { _: 'Cheltuiala nu a putut fi salvată.' });
    }
  }

  return (
    <Sheet title={expense ? 'Editează cheltuiala' : 'Cheltuială nouă'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <SelectField label="Categorie" value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((x) => ({ value: x, label: EXPENSE_LABEL[x] }))} />
        <div className="grid-2">
          <NumberField label="Sumă" unit={c} value={amountText} onChange={setAmount} error={errors.amountMinor} autoFocus={!expense} />
          <TextField type="date" label="Data" value={date} onChange={setDate} error={errors.date} />
        </div>
        {vehicles && vehicles.length > 1 && (
          <SelectField label="Vehicul (opțional)" value={vehicleId} onChange={setVehicleId} options={[{ value: '', label: '—' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]} />
        )}
        <TextField label="Notă (opțional)" value={note} onChange={setNote} maxLength={200} error={errors.note} />
        {isEnergy && (
          <p className="notice">Bonurile de combustibil și încărcare nu se scad din profit (energia e deja estimată pe fiecare cursă). Apar pe Acasă în comparația estimat vs. plătit.</p>
        )}
        {errors._ && <p className="field-error" role="alert">{errors._}</p>}
        <div className="grid-2">
          {expense ? (
            <button type="button" className="btn btn-danger" onClick={async () => {
              await softDeleteExpense(expense.id);
              toast('Cheltuială ștearsă', { actionLabel: 'Anulează', onAction: () => void restoreExpense(expense.id) });
              onClose();
            }}>
              Șterge
            </button>
          ) : <span />}
          <button type="submit" className="btn btn-primary">Salvează</button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------- Obiective și rezervă ----------

export function GoalsSheet({ settings, onClose }: { settings: AppSettings; onClose: () => void }) {
  const toast = useToast();
  const [daily, setDaily] = useState(moneyField(settings.goals.dailyMinor));
  const [monthly, setMonthly] = useState(moneyField(settings.goals.monthlyMinor));
  const [tax, setTax] = useState(settings.taxReservePct ? toField(settings.taxReservePct) : '');
  const [reminder, setReminder] = useState(String(settings.backupReminderDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const c = settings.currency;

  async function save() {
    const errs: Record<string, string> = {};
    const opt = (s: string, key: string): number | null => {
      if (s.trim() === '') return null;
      const r = readMoney(s, '');
      if (r.error) errs[key] = r.error;
      return r.value;
    };
    const d = opt(daily, 'dailyMinor');
    const m = opt(monthly, 'monthlyMinor');
    const t = tax.trim() === '' ? 0 : parseDecimal(tax);
    if (t === null) errs.tax = 'Număr invalid.';
    const goals = goalsSchema.safeParse({ dailyMinor: d === null ? null : toMinor(d), monthlyMinor: m === null ? null : toMinor(m) });
    if (!goals.success) for (const i of goals.error.issues) errs[String(i.path[0])] ??= i.message;
    const taxOk = taxReservePctSchema.safeParse(t ?? 0);
    if (!taxOk.success) errs.tax = taxOk.error.issues[0]!.message;
    if (Object.keys(errs).length || !goals.success || !taxOk.success) return setErrors(errs);
    await updateSettings({ goals: goals.data, taxReservePct: taxOk.data, backupReminderDays: Number(reminder) });
    toast('Setări salvate');
    onClose();
  }

  return (
    <Sheet title="Obiective și rezervă" onClose={onClose}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="small muted">Lasă gol ce nu vrei să urmărești. Pentru perioade mai lungi de o zi, Acasă folosește obiectivul lunar împărțit pe zile.</p>
        <div className="grid-2">
          <NumberField label="Obiectiv zilnic" unit={c} value={daily} onChange={setDaily} error={errors.dailyMinor} />
          <NumberField label="Obiectiv lunar" unit={c} value={monthly} onChange={setMonthly} error={errors.monthlyMinor} />
        </div>
        <p className="section-label">Rezervă pentru taxe</p>
        <NumberField label="Procent din profit pus deoparte" unit="%" value={tax} onChange={setTax} error={errors.tax} hint="Un provizion ales de tine, nu un calcul fiscal. Întreabă contabilul ce procent ți se potrivește." />
        <p className="section-label">Memento backup</p>
        <SelectField label="Amintește-mi după" value={reminder} onChange={setReminder} options={[3, 7, 14, 30].map((n) => ({ value: String(n), label: `${n} zile fără backup` }))} />
        <button type="submit" className="btn btn-primary btn-block">Salvează</button>
      </form>
    </Sheet>
  );
}

// ---------- Costuri fixe ----------

export function FixedCostsSheet({ settings, onClose }: { settings: AppSettings; onClose: () => void }) {
  const costs = useLiveQuery(() => db.fixedCosts.toArray(), []);
  const [editing, setEditing] = useState<FixedCostEntity | 'new' | null>(null);
  const c = settings.currency;
  const now = new Date();
  const active = (costs ?? []).filter((f) => !f.activeUntil || f.activeUntil > now);
  const stopped = (costs ?? []).filter((f) => f.activeUntil && f.activeUntil <= now);
  const total = active.reduce((s, f) => s + f.monthlyAmountMinor, 0);

  const row = (f: FixedCostEntity) => (
    <button key={f.id} type="button" className="list-row" onClick={() => setEditing(f)}>
      <span className="ico"><Icon name="calendar" /></span>
      <span>
        <b>{f.name}</b>
        <span className="sub" style={{ display: 'block' }}>
          din {format(f.activeFrom, 'd MMM yyyy', { locale: ro })}
          {f.activeUntil ? ` până la ${format(f.activeUntil, 'd MMM yyyy', { locale: ro })}` : ''}
        </span>
      </span>
      <span className="end num">{amount(f.monthlyAmountMinor)}</span>
    </button>
  );

  return (
    <Sheet title="Costuri fixe lunare" onClose={onClose}>
      <p className="small muted" style={{ marginBottom: 12 }}>
        RCA, CASCO, leasing, licență, telefon, contabil. Se împart pe zile și se scad din profitul fiecărei perioade.
      </p>
      <div className="list">
        {active.map(row)}
        <button type="button" className="list-row" onClick={() => setEditing('new')}>
          <span className="ico"><Icon name="plus" /></span>
          <b>Adaugă cost fix</b>
          <span />
        </button>
      </div>
      {active.length > 0 && <p className="small muted" style={{ margin: '8px 4px' }}>Total activ: {money(total, c)} pe lună</p>}
      {stopped.length > 0 && (
        <>
          <p className="section-label">Oprite (contează doar în lunile în care au fost active)</p>
          <div className="list">{stopped.map(row)}</div>
        </>
      )}
      {editing && <FixedCostForm settings={settings} cost={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function FixedCostForm({ settings, cost, onClose }: { settings: AppSettings; cost?: FixedCostEntity; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(cost?.name ?? '');
  const [amountText, setAmount] = useState(moneyField(cost?.monthlyAmountMinor));
  const [from, setFrom] = useState(dayInput(cost?.activeFrom ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const { value: v, error } = readMoney(amountText, 'Introdu suma lunară.');
    const day = parseDay(from);
    if (v === null || !day) return setErrors({ ...(error ? { monthlyAmountMinor: error } : {}), ...(!day ? { activeFrom: 'Alege data.' } : {}) });
    try {
      await saveFixedCost({ name, monthlyAmountMinor: toMinor(v), activeFrom: day, activeUntil: cost?.activeUntil ?? null }, cost?.id);
      toast('Cost fix salvat');
      onClose();
    } catch (e) {
      setErrors(e instanceof ValidationError ? e.fieldErrors : { _: 'Nu a putut fi salvat.' });
    }
  }

  const today = new Date();
  const stopFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return (
    <Sheet title={cost ? cost.name : 'Cost fix nou'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <TextField label="Denumire" value={name} onChange={setName} error={errors.name} placeholder="Ex.: RCA" maxLength={60} />
        <div className="grid-2">
          <NumberField label="Sumă pe lună" unit={settings.currency} value={amountText} onChange={setAmount} error={errors.monthlyAmountMinor} hint="Pentru plăți anuale, împarte la 12." />
          <TextField type="date" label="Activ de la" value={from} onChange={setFrom} error={errors.activeFrom} />
        </div>
        {errors.activeUntil && <p className="field-error">{errors.activeUntil}</p>}
        {errors._ && <p className="field-error">{errors._}</p>}
        <button type="submit" className="btn btn-primary btn-block">Salvează</button>
        {cost && (
          <div className="grid-2">
            {!cost.activeUntil || cost.activeUntil > today ? (
              <button type="button" className="btn" onClick={async () => { await stopFixedCost(cost.id, stopFrom); toast('Oprit de mâine; lunile trecute rămân neschimbate'); onClose(); }}>
                Oprește-l
              </button>
            ) : (
              <button type="button" className="btn" onClick={async () => { await db.fixedCosts.update(cost.id, { activeUntil: null, updatedAt: new Date() }); toast('Reactivat'); onClose(); }}>
                Reactivează
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              await deleteFixedCost(cost.id);
              toast('Cost fix șters');
              onClose();
            }}>
              {confirmDelete ? 'Sigur? Dispare din toate lunile' : 'Șterge (greșit introdus)'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
