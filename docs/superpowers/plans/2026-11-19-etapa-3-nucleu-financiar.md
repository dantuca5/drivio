# Etapa 3 — Nucleul financiar: plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modulul `src/domain/` — TypeScript pur, fără UI și fără stocare — care face toate calculele financiare, cu teste.

**Architecture:** Funcții pure, timp primit ca parametru, sume de tranzacție în subunități întregi (bani), prețuri unitare ca zecimale. Fiecare componentă a cursei se rotunjește la bani, iar profitul = diferența componentelor rotunjite (detaliile se adună exact).

**Tech Stack:** TypeScript strict, Vitest, fast-check, Zod, date-fns. TZ testelor: `Europe/Bucharest`.

**Spec:** [docs/ARHITECTURA.md](../../ARHITECTURA.md) § 5.4, § 6, § 10; [docs/UX.md](../../UX.md) § 5.

## Global Constraints

- Nicio valoare financiară implicită în `domain/` (comisioane, prețuri, praguri vin ca parametri).
- `domain/` nu importă din `services/`, `features/`, `ui/`, nu folosește `Date.now()`/`new Date()` fără argument.
- Niciun rezultat `NaN`/`Infinity`: rapoartele cu numitor 0 sunt `null`.
- Rotunjire: jumătate în sus (în afară de zero pentru negative), la bani.
- Comision validat 0–99,9%.
- Mesajele de validare în română.

## Review Focus

1. Suma introdusă „net” cu comision 0% → tarif brut = net, comision 0.
2. Cursă cu 0 km (taxă de anulare) → rapoarte pe km `null`, verdict nu crapă.
3. Perioadă care traversează schimbarea orei (25 oct 2026) → zile corecte, fără zi dublată/pierdută.
4. Introducere cu virgulă și separator de mii („1.234,56”, „35,5”, „35.5”) → valori corecte; text invalid → `null`.
5. Costuri fixe pentru „luna curentă” la mijlocul lunii → alocare doar până azi inclusiv.

---

## File structure

| Fișier | Responsabilitate |
|---|---|
| `src/domain/money.ts` | `Minor`, rotunjire, conversii, parsare input, formatare |
| `src/domain/types.ts` | tipuri comune (Platform, FareMode, Vehicle*, CostSnapshot, RideInput, RideResult, Thresholds, Expense, FixedCost) |
| `src/domain/vehicleCost.ts` | preț mediu kWh, energie/km, uzură/km, snapshot |
| `src/domain/rideCalc.ts` | `calculateRide` |
| `src/domain/verdict.ts` | `evaluateVerdict` |
| `src/domain/minRate.ts` | tarif minim /km și /oră |
| `src/domain/periods.ts` | rezolvarea perioadelor |
| `src/domain/aggregate.ts` | sumar perioadă, alocare costuri fixe, serii zilnice, top curse, comparație platforme |
| `src/domain/goals.ts` | obiectiv pe perioadă și progres |
| `src/domain/schemas.ts` | scheme Zod pentru toate intrările |
| `src/domain/index.ts` | export public |

### Task 1: Proiect + money
**Files:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/domain/money.ts`, `src/domain/__tests__/money.test.ts`
**Produces:** `type Minor = number`; `roundHalfUp(x:number, decimals=0):number`; `toMinor(major:number):Minor`; `fromMinor(m:Minor):number`; `parseDecimal(s:string):number|null`; `formatMoney(m:Minor, currency:string, locale='ro-RO'):string`; `formatNumber(n:number|null, decimals=2, locale='ro-RO'):string` ("—" pentru null).
- [ ] Teste: `toMinor(0.1+0.2)===30`, `toMinor(2.675)===268`, `toMinor(-1.005)===-101`; `parseDecimal('35,5')===35.5`, `'35.5'→35.5`, `'1.234,56'→1234.56`, `'1,234.56'→1234.56`, `'1.234.567'→1234567`, `' 12 '→12`, `'abc'→null`, `''→null`; `formatMoney(123456,'RON')` conține `1.234,56` și `RON`; `formatNumber(null)==='—'`.
- [ ] Rulează → FAIL; implementează; rulează → PASS; commit.

### Task 2: Cost vehicul
**Files:** `types.ts`, `vehicleCost.ts`, test
**Produces:** `blendedKWhPrice(v:EvEnergy):number`; `energyCostPerKm(v:VehicleEnergy):number`; `tiresCostPerKm(v:WearCosts):number`; `wearCostPerKm(v:WearCosts):number`; `buildCostSnapshot(v:VehicleCostProfile, commissionPct:number):CostSnapshot` cu `{commissionPct, energyCostPerKm, wearCostPerKm}`.
`VehicleEnergy` = uniune discriminată după `powertrain`: combustibil (`fuelConsumptionLPer100`, `fuelPricePerL`) sau `electric` (`evConsumptionKWhPer100`, `homePricePerKWh`, `publicPricePerKWh`, `homeSharePct`, `chargingLossPct`).
- [ ] Teste: EV 17 kWh/100, 70% acasă 1,00, public 2,20, pierderi 0 → preț mediu 1,36, energie/km 0,2312; pierderi 10% → 0,2312/0,9; benzină 7 L/100 la 7,50 → 0,525; anvelope 2.000 RON / 40.000 km → 0,05; anvelope cu durată 0 → 0; uzură = anvelope + mentenanță + depreciere + alte.

### Task 3: Calculul cursei
**Files:** `rideCalc.ts`, test
**Consumes:** `CostSnapshot`. **Produces:** `calculateRide(input:RideInput, s:CostSnapshot):RideResult`.
`RideInput {fareMinor, fareMode:'gross'|'net', tripKm, tripMin, pickupKm, pickupMin, waitMin, tipMinor, bonusMinor, energyCostOverrideMinor?:Minor|null}`.
`RideResult {grossFareMinor, commissionMinor, grossIncomeMinor, incomeAfterCommissionMinor, energyCostMinor, wearCostMinor, vehicleCostMinor, totalCostMinor, profitMinor, totalKm, totalMin, profitPerKm|null, profitPerHour|null, realCostPerKm|null, yieldPct|null}` (rapoarte în unități majore, nerotunjite).
- [ ] Test de referință (ARHITECTURA § 10): profit 1868, comision 875, energie 277, uzură 480, profitPerKm≈1,5567, profitPerHour≈41,511, realCostPerKm≈0,6308, yield≈53,37.
- [ ] Mod net: 2625 net la 25% → brut 3500, comision 875. Net la 0% → comision 0.
- [ ] Bacșiș 500 + bonus 300 nu se comisionează. Suprascriere energie folosită exact.
- [ ] 0 km și 0 min → rapoarte `null`; venit 0 → yield `null`.
- [ ] Proprietăți (fast-check): `profit === grossIncome − totalCost`; `totalCost === commission + vehicleCost`; nicio valoare NaN/Infinity.

### Task 4: Verdict
**Files:** `verdict.ts`, test
**Produces:** `evaluateVerdict(r:RideResult, t:Thresholds):{level:'go'|'slow'|'stop', reasons:VerdictReason[]}`; `VerdictReason = 'loss'|'belowRedHour'|'belowRedKm'|'belowGreenHour'|'belowGreenKm'|'meetsTargets'|'insufficientData'`.
Regula: ARHITECTURA § 6.3; metricile `null` nu se verifică; dacă ambele sunt `null` și profit > 0 → `slow` + `insufficientData`.
- [ ] Teste: referință cu praguri 30/40 RON/oră, 1,0/1,4 RON/km → `go`; profit ≤ 0 → `stop`+`loss`; 35 RON/oră → `slow`+`belowGreenHour`; 0 km cu profit → nu crapă.

### Task 5: Tarif minim
**Files:** `minRate.ts`, test
**Produces:** `minFarePerPaidKm({costPerKm, targetProfitPerHour, avgSpeedKmh, emptyKmPct, commissionPct, fixedCostPerHour=0}):number|null`
`= (costPerKm + (target+fixed)/speed) / ((1 − empty) × (1 − c))`;
`minGrossPerHour({costPerKm, targetProfitPerHour, kmPerWorkHour, commissionPct, fixedCostPerHour=0, paidTimePct?}):{perWorkHour:number, perPaidHour:number|null}`
`perWorkHour = (target + fixed + kmPerWorkHour × costPerKm)/(1 − c)`, `perPaidHour = perWorkHour / paid%`.
- [ ] Teste: cost 0,631, țintă 40, 25 km/h, 20% gol, 25% → 3,7183; viteză 0 → null; verificare inversă: o cursă la tariful minim dă exact profitul țintă/oră.

### Task 6: Perioade, agregare, obiective
**Files:** `periods.ts`, `aggregate.ts`, `goals.ts`, teste
**Produces:** `PeriodSpec = {kind:'today'|'yesterday'|'last7'|'last30'|'thisMonth'} | {kind:'month', month:'YYYY-MM'} | {kind:'custom', from:'YYYY-MM-DD', to:'YYYY-MM-DD'}`; `resolvePeriod(spec, now:Date):{start:Date, end:Date}` (end exclusiv, ora locală);
`allocateFixedCosts(monthlyMinor:Minor, start:Date, end:Date):Minor`;
`summarize({rides, expenses, fixedCosts, range, now, taxReservePct}):PeriodSummary`;
`dailySeries(...)`, `platformComparison(rides)`, `rankRides(rides, by, n, dir)`;
`goalForRange(goals, range):Minor|null`, `goalProgress(profitMinor, goalMinor)`.
Costurile fixe se alocă doar până la sfârșitul zilei curente. Cheltuielile `fuel`/`charging` intră doar în `energyPaidMinor`.
- [ ] Teste: `last7` = azi + 6 zile anterioare; săptămâna 22–28 oct 2026 are 7 zile distincte (DST); `thisMonth` pe 19 nov alocă 19/30 din costul fix; o lună întreagă alocă exact costul lunar; sumar cu 2 curse + cheltuială service + bon încărcare verifică fiecare total; rezerva de taxe 0 când profitul e negativ.

### Task 7: Scheme de validare
**Files:** `schemas.ts`, test
**Produces:** `rideInputSchema`, `vehicleSchema`, `thresholdsSchema` (roșu ≤ verde), `expenseSchema`, `fixedCostSchema`, `goalsSchema`.
- [ ] Teste: comision 100 respins; km negativi respinși; 2.001 km respinși; EV fără preț acasă respins; praguri roșu > verde respinse; mesajele sunt în română.

### Task 8: Verificare finală
- [ ] `npx vitest run` → toate PASS; `npx tsc --noEmit` → 0 erori; grep că `domain/` nu importă din alte straturi.
