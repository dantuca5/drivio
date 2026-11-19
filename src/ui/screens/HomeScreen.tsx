import { differenceInCalendarDays, formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { dailySeries, formatNumber, goalForRange, goalProgress, platformComparison, resolvePeriod, summarize, type PeriodSpec } from '../../domain';
import { useExpensesAndFixedCosts, useNow, useRidesInRange } from '../../features/hooks';
import { db } from '../../services/db';
import type { AppSettings } from '../../services/entities';
import { DailyChart, type ChartMetric } from '../components/DailyChart';
import { EmptyState, Segmented } from '../components/controls';
import { Icon } from '../components/Icon';
import { PeriodPicker, periodLabel } from '../components/PeriodPicker';
import { amount, money } from '../format';
import { ESTIMATE_NOTE } from '../text';

const METRIC_TITLE: Record<ChartMetric, string> = { profit: 'Profit pe zile', income: 'Venit pe zile', costs: 'Costuri pe zile' };

interface Props {
  settings: AppSettings;
  onExport: (p: PeriodSpec) => void;
  onBackup: () => void;
}

export function HomeScreen({ settings, onExport, onBackup }: Props) {
  const now = useNow();
  const [period, setPeriod] = useState<PeriodSpec>({ kind: 'today' });
  const [metric, setMetric] = useState<ChartMetric>('profit');
  const dayKeyNow = now.toDateString(); // intervalul se recalculează doar când se schimbă ziua
  const range = useMemo(() => resolvePeriod(period, now), [period, dayKeyNow]);
  const rides = useRidesInRange(range);
  const extra = useExpensesAndFixedCosts();
  const totalRides = useLiveQuery(() => db.rides.count(), []);
  const c = settings.currency;

  const summary = useMemo(() => {
    if (!rides || !extra) return null;
    return summarize({ rides, expenses: extra.expenses, fixedCosts: extra.fixedCosts, range, now, taxReservePct: settings.taxReservePct });
  }, [rides, extra, range, now, settings.taxReservePct]);

  const days = differenceInCalendarDays(range.end, range.start);
  const series = useMemo(() => {
    if (!rides || !extra || days <= 1) return null;
    return dailySeries({ rides, expenses: extra.expenses, fixedCosts: extra.fixedCosts, range, now });
  }, [rides, extra, range, now, days]);

  const goal = goalForRange(settings.goals, range);
  const progress = summary ? goalProgress(summary.periodProfitMinor, goal) : null;
  const platforms = rides ? platformComparison(rides) : null;

  const backupDue =
    (totalRides ?? 0) > 0 &&
    (!settings.lastBackupAt || now.getTime() - settings.lastBackupAt.getTime() > settings.backupReminderDays * 86_400_000);

  return (
    <>
      <PeriodPicker value={period} onChange={setPeriod} now={now} />

      {backupDue && (
        <div className="notice" style={{ marginTop: 12, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>
            {settings.lastBackupAt ? `Ultimul backup ${formatDistanceToNow(settings.lastBackupAt, { locale: ro, addSuffix: true })}.` : 'Nu ai făcut încă un backup.'} Datele stau doar pe telefon.
          </span>
          <button type="button" className="btn btn-small" onClick={onBackup}>Fă backup</button>
        </div>
      )}

      {summary && (
        <>
          <p className="hero-label">
            Profit operațional estimat · {periodLabel(period, range)}
          </p>
          <p className={`hero-num num ${summary.periodProfitMinor < 0 ? 'negative' : ''}`}>
            {amount(summary.periodProfitMinor)}
            <small>{c}</small>
          </p>
          {goal !== null && progress?.ratio != null && (
            <>
              <div className="road" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(progress.ratio, 1) * 100)} aria-label="Progres spre obiectiv">
                <i style={{ width: `${Math.min(progress.ratio, 1) * 100}%` }} />
              </div>
              <div className="row small">
                <span className="muted">
                  {progress.reached ? 'Obiectiv atins' : `${formatNumber(progress.ratio * 100, 0)}% din obiectiv · mai ai ${money(progress.remainingMinor ?? 0, c)}`}
                </span>
                <span className="num">{money(goal, c)}</span>
              </div>
            </>
          )}
          {summary.taxReserveMinor > 0 && (
            <p className="small" style={{ marginTop: 8 }}>
              <span className="muted">Rezervă taxe ({formatNumber(settings.taxReservePct, 0)}%):</span> <b className="num">{money(summary.taxReserveMinor, c)}</b>
              <span className="muted"> · disponibil </span><b className="num">{money(summary.afterReserveMinor, c)}</b>
            </p>
          )}
          <p className="estimate-note">
            {ESTIMATE_NOTE}
            {summary.fixedCostsAllocatedMinor > 0 && ` Include costurile fixe ale perioadei (${money(summary.fixedCostsAllocatedMinor, c)}).`}
          </p>

          {summary.rideCount === 0 && summary.expensesMinor === 0 ? (
            <EmptyState title="Nicio cursă în această perioadă">
              <p>Apasă ＋ ca să adaugi o cursă.</p>
            </EmptyState>
          ) : (
            <div className="stats">
              <div className="stats-line">
                <div><span>Venituri</span><b className="num">{amount(summary.grossIncomeMinor)}</b></div>
                <div><span>Comisioane</span><b className="num">{amount(summary.commissionMinor)}</b></div>
                <div><span>Costuri totale</span><b className="num">{amount(summary.totalCostsMinor)}</b></div>
              </div>
              <div className="stats-line">
                <div><span>Curse</span><b className="num">{summary.rideCount}</b></div>
                <div><span>Kilometri</span><b className="num">{formatNumber(summary.km, 0)}</b></div>
                <div><span>Ore cu curse</span><b className="num">{formatNumber(summary.hours, 1)}</b></div>
              </div>
              <div className="stats-line">
                <div><span>Profit/cursă</span><b className="num">{summary.avgProfitPerRideMinor === null ? '—' : amount(summary.avgProfitPerRideMinor)}</b></div>
                <div><span>Profit/km</span><b className="num">{formatNumber(summary.profitPerKm)}</b></div>
                <div><span>Profit/oră</span><b className="num">{formatNumber(summary.profitPerHour)}</b></div>
              </div>
              <div className="stats-line">
                <div><span>Energie estimată</span><b className="num">{amount(summary.energyEstimatedMinor)}</b></div>
                <div><span>Uzură</span><b className="num">{amount(summary.wearMinor)}</b></div>
                <div><span>Cheltuieli</span><b className="num">{amount(summary.expensesMinor)}</b></div>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>Mediile pe cursă, km și oră se calculează din profitul curselor, fără cheltuieli și costuri fixe.</p>
            </div>
          )}

          {series && summary.rideCount > 0 && (
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <p className="panel-title" style={{ margin: 0 }}>{METRIC_TITLE[metric]}</p>
              </div>
              <Segmented
                label="Indicator grafic"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'profit', label: 'Profit' },
                  { value: 'income', label: 'Venit' },
                  { value: 'costs', label: 'Costuri' },
                ]}
                className="seg-small"
              />
              <div style={{ marginTop: 12 }}>
                <DailyChart points={series} metric={metric} currency={c} title={`${METRIC_TITLE[metric]}, ${periodLabel(period, range)}`} />
              </div>
            </div>
          )}

          {platforms && platforms.uber.rideCount > 0 && platforms.bolt.rideCount > 0 && (
            <div className="panel" style={{ marginTop: 14 }}>
              <p className="panel-title">Uber vs Bolt · profit pe oră</p>
              <div className="versus">
                <div><span className="small muted">Uber · {platforms.uber.rideCount} curse</span><b className="num">{formatNumber(platforms.uber.profitPerHour)}<small> {c}/oră</small></b></div>
                <div><span className="small muted">Bolt · {platforms.bolt.rideCount} curse</span><b className="num">{formatNumber(platforms.bolt.profitPerHour)}<small> {c}/oră</small></b></div>
              </div>
            </div>
          )}

          {summary.energyPaidMinor > 0 && (
            <div className="panel" style={{ marginTop: 14 }}>
              <p className="panel-title">Energie: estimat vs plătit</p>
              <div className="row"><span className="muted">Estimat din curse</span><b className="num">{money(summary.energyEstimatedMinor, c)}</b></div>
              <div className="row" style={{ marginTop: 4 }}><span className="muted">Plătit (bonuri)</span><b className="num">{money(summary.energyPaidMinor, c)}</b></div>
              {summary.energyEstimatedMinor > 0 && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  Diferență {formatNumber(((summary.energyPaidMinor - summary.energyEstimatedMinor) / summary.energyEstimatedMinor) * 100, 0)}%. Dacă rămâne mare pe mai multe săptămâni, ajustează consumul sau prețurile vehiculului.
                </p>
              )}
            </div>
          )}

          <button type="button" className="btn btn-block" style={{ marginTop: 18 }} onClick={() => onExport(period)}>
            <Icon name="download" width={18} height={18} style={{ verticalAlign: -3, marginRight: 8 }} />
            Exportă perioada (PDF sau CSV)
          </button>
        </>
      )}
    </>
  );
}
