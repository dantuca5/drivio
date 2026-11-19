import { formatNumber, type RideResult, type Thresholds, type Verdict } from '../../domain';
import { amount, pct, perHour, perKm } from '../format';
import { verdictReason, VERDICT_WORD } from '../text';

interface VerdictCardProps {
  result: RideResult | null;
  verdict: Verdict | null;
  thresholds: Thresholds;
  currency: string;
  emptyText?: string;
}

/** Câmpul colorat cu verdictul. Fără date suficiente rămâne neutru, cu o instrucțiune. */
export function VerdictCard({ result, verdict, thresholds, currency, emptyText = 'Completează suma, km cu client și minutele cursei.' }: VerdictCardProps) {
  if (!result || !verdict) {
    return (
      <div className="verdict" data-level="none" aria-live="polite">
        <div className="verdict-word">Verdict</div>
        <p className="verdict-why">{emptyText}</p>
      </div>
    );
  }
  const big = result.profitPerHour;
  return (
    <div className="verdict" data-level={verdict.level} aria-live="polite">
      <div className="row" style={{ alignItems: 'baseline' }}>
        <span className="verdict-word">{VERDICT_WORD[verdict.level]}</span>
        <span className="verdict-big num tick" key={big === null ? 'x' : big.toFixed(2)}>
          {big === null ? '—' : formatNumber(big)}
          <small> {currency}/oră</small>
        </span>
      </div>
      <p className="verdict-why">{verdictReason(verdict, thresholds, currency)}</p>
      <div className="verdict-sub num">
        <span>Profit {amount(result.profitMinor)}</span>
        <span>{perKm(result.profitPerKm, currency)}</span>
        <span>Randament {pct(result.yieldPct)}</span>
      </div>
    </div>
  );
}

/** Fiecare rând al calculului; rândurile în bani se adună exact. */
export function CalcDetails({ result, currency, open = false }: { result: RideResult; currency: string; open?: boolean }) {
  const rows: [string, string, boolean?][] = [
    ['Tarif brut', amount(result.grossFareMinor)],
    ['Venit brut (cu bacșiș și bonus)', amount(result.grossIncomeMinor)],
    ['Comision platformă', `−${amount(result.commissionMinor)}`],
    ['Venit după comision', amount(result.incomeAfterCommissionMinor)],
    [`Energie (${formatNumber(result.totalKm, 1)} km)`, `−${amount(result.energyCostMinor)}`],
    ['Uzură și mentenanță', `−${amount(result.wearCostMinor)}`],
    ['Cost total cursă', amount(result.totalCostMinor)],
    ['Profit operațional estimat', `${amount(result.profitMinor)} ${currency}`, true],
    ['Profit pe km', perKm(result.profitPerKm, currency)],
    ['Profit pe oră', perHour(result.profitPerHour, currency)],
    ['Cost real pe km', perKm(result.realCostPerKm, currency)],
    ['Randament', pct(result.yieldPct, 1)],
    ['Timp total', `${formatNumber(result.totalMin, 0)} min`],
  ];
  return (
    <details className="details" open={open}>
      <summary>Detalii calcul</summary>
      <dl>
        {rows.map(([k, v, total]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className={total ? 'total' : ''}>{k}</dt>
            <dd className={total ? 'total' : ''}>{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
