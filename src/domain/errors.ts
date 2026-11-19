/** Eroare a nucleului de calcul: o intrare invalidă a ajuns până aici, ocolind validarea. */
export class DomainError extends Error {
  override name = 'DomainError';
}

export function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(`${label}: valoare invalidă (${String(value)}).`);
  }
}

/** Comisionul trebuie să fie în [0, 99,9]; 100% ar face imposibilă conversia net → brut. */
export function assertCommissionPct(pct: number): void {
  if (!Number.isFinite(pct) || pct < 0 || pct > 99.9) {
    throw new DomainError(`Comision invalid: ${String(pct)}%. Valoarea trebuie să fie între 0 și 99,9.`);
  }
}
