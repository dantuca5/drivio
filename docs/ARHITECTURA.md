# Arhitectura aplicației — Etapa 1

> Nume de lucru: **Drivio** (se poate schimba oricând; nu e legat de cod).
> Data: 2026-11-19 · Stare: **propunere, așteaptă aprobare**

---

## 1. Intenție și motiv

Un șofer Uber/Bolt din România trebuie să știe, în câteva secunde, dacă o cursă merită
acceptată și, la final de zi/săptămână/lună, cât a câștigat **cu adevărat** după comision,
energie/combustibil, uzură și costuri fixe. Platformele arată doar încasările; costurile
reale ale mașinii și kilometrii goi până la client rămân invizibili.

Aplicația rezolvă asta: introducere rapidă a cursei → verdict colorat instant → istoric și
statistici credibile, totul pe iPhone 13 Pro, offline, fără costuri de operare.

## 2. Obiective, non-obiective, anti-obiective

**Obiective (v1)**
- Calculator de profitabilitate per cursă, cu kilometri și timp de preluare incluși.
- Mai multe vehicule (benzină, motorină, GPL, hibrid, electric), cu calculator EV dedicat (acasă / stații publice).
- Dashboard cu filtre de perioadă și grafice; istoric cu filtrare, căutare, editare, ștergere, comparație platforme, top/bottom curse.
- Setări financiare complete, monedă configurabilă (RON implicit).
- Instrumente: tarif minim/km, tarif minim/oră, simulare înainte de acceptare, comparare două curse.
- Obiective zilnice/lunare, cheltuieli manuale, export CSV și PDF, backup/restaurare.
- Instalabilă pe ecranul principal al iPhone-ului, offline, date persistente.

**Non-obiective (v1)**
- Conectare la conturile Uber/Bolt (nu există API public pentru șoferi). Arhitectura păstrează un punct de extensie (§ 9).
- Calcul de impozite/contribuții (CAS, CASS, impozit PFA/SRL, TVA). Regimurile diferă de la șofer la șofer; un calcul greșit ar fi mai rău decât niciunul. Oferim doar o **rezervă pentru taxe în %**, setată de utilizator și etichetată ca provizion, nu ca impozit calculat.
- Sincronizare în cloud / conturi de utilizator. Datele rămân doar pe telefon (plus backup-urile tale).
- Conversie valutară. Schimbarea monedei schimbă simbolul și formatarea, nu convertește sumele.

**Anti-obiective (ar fi eșec chiar dacă „funcționează”)**
- Un număr afișat ca „profit net” care e de fapt o estimare. Orice profit din aplicație e etichetat **„profit operațional estimat”**.
- Pierderea datelor (actualizare, ștergere de către iOS, import greșit).
- Introducerea unei curse care cere mai mult de ~10 secunde în cazul obișnuit.
- Butoane sau ecrane care nu fac nimic real.
- Istoric care se modifică singur când schimbi setările (vezi „instantaneu” în § 5.4).

## 3. Constrângeri

- Dispozitiv: iPhone 13 Pro (390×844 pt, notch). Dezvoltare pe Windows, fără Mac.
- Cost: zero (fără cont Apple Developer, găzduire gratuită).
- iOS Safari ca motor: fără push obligatoriu, stocare IndexedDB care poate fi ștearsă de iOS în condiții rare → backup obligatoriu ca funcție de prim rang.
- Fără valori financiare „magice” în cod: comisioane, prețuri, costuri vin numai din setările utilizatorului.

## 4. Abordări considerate

| Abordare | Avantaje | Dezavantaje | Decizie |
|---|---|---|---|
| **A. PWA: React + TypeScript + Vite** | Gratuită, instalabilă azi, ecosistem mare, TS prinde erori în formule, logică reutilizabilă | Stocare iOS mai fragilă decât nativ | **Aleasă de tine** |
| B. PWA fără framework | Foarte mică | Cod greu de întreținut la această mărime | Respinsă |
| C. Expo / Capacitor (nativ) | Stocare SQLite robustă, App Store | 99 USD/an, build în cloud, fără câștig real pentru tine | Respinsă (fără Mac, cost) |

## 5. Arhitectura

### 5.1 Stivă tehnică (decizia mea, justificată)

| Domeniu | Alegere | De ce |
|---|---|---|
| Limbaj | TypeScript (strict) | Tipuri pentru bani, unități, entități |
| UI | React 18 + Vite | Rapid, matur, build mic |
| Stil | CSS simplu cu variabile (tokeni) pentru teme — *Etapa 4: înlocuiește Tailwind* | Sistemul de design e mic și definit deja în schițe; o dependență în minus |
| Animații | Tranziții și animații CSS — *Etapa 4: înlocuiește Motion* | Cele câteva animații discrete nu justifică o bibliotecă; respectă „Reducere mișcare” |
| Navigare | Stare React (4 tab-uri + foi) — fără router | Aplicație instalată, fără URL-uri de partajat |
| Grafice | Recharts | Interactive (atingere/tooltip), suficient de ușor |
| Stocare | IndexedDB prin **Dexie** + `dexie-react-hooks` | Tranzacții, indexuri, migrări de schemă, UI reactiv |
| Validare | **Zod** | Aceleași scheme pentru formulare, import backup și CSV |
| Date/ore | date-fns (+ locale `ro`) | Perioade, fus orar local |
| PWA | vite-plugin-pwa (Workbox) | Offline complet, actualizări controlate |
| PDF | jsPDF + jspdf-autotable | Rapoarte generate local, fără server |
| Teste | Vitest (+ fast-check), Testing Library, Playwright (WebKit, profil iPhone 13) | Formule, componente, fluxuri end-to-end |

### 5.2 Straturi și dependențe (regula: dependențele merg doar în jos)

```
┌──────────────────────────────────────────────────────────────┐
│ ui/        ecrane, componente, navigare, teme  (React)       │
├──────────────────────────────────────────────────────────────┤
│ features/  hook-uri pe funcționalitate: useRideForm,          │
│            useDashboard, useHistory, useExport ...           │
├──────────────────────────────────────────────────────────────┤
│ services/  export CSV/PDF, backup/restore, importuri,         │
│            persistență (repositories)                        │
├──────────────────────────────────────────────────────────────┤
│ domain/    TypeScript PUR: tipuri, formule, agregări,         │
│            praguri, validări. Zero React, zero IndexedDB.    │
└──────────────────────────────────────────────────────────────┘
```

`domain/` nu importă nimic din straturile de deasupra și nu atinge rețeaua, stocarea sau
`Date.now()` (timpul se primește ca parametru). Asta îl face 100% testabil și refolosibil
(ex. într-o viitoare aplicație nativă).

### 5.3 Structura fișierelor

```
drivio/
├─ docs/                     ARHITECTURA.md, UX.md, INSTALARE.md
├─ public/                   icoane, splash screens iOS, manifest
├─ src/
│  ├─ domain/
│  │  ├─ money.ts            rotunjire, formatare (fără float la stocare)
│  │  ├─ types.ts            Ride, Vehicle, Expense, Settings, Snapshot ...
│  │  ├─ vehicleCost.ts      cost energie/km (ICE, EV mixt acasă/public), uzură/km
│  │  ├─ rideCalc.ts         calculul complet al unei curse
│  │  ├─ verdict.ts          verde / galben / roșu
│  │  ├─ minRate.ts          tarif minim /km și /oră
│  │  ├─ aggregate.ts        totaluri pe perioadă, medii, serii pentru grafice
│  │  ├─ periods.ts          Astăzi, Ieri, 7 zile, 30 zile, luna curentă, luni anterioare, interval
│  │  ├─ goals.ts            progres obiective
│  │  ├─ schemas.ts          scheme Zod (input, backup, CSV)
│  │  └─ __tests__/          teste pentru fiecare modul
│  ├─ services/
│  │  ├─ db.ts               Dexie: tabele, indexuri, migrări versionate
│  │  ├─ repositories/       rides, vehicles, expenses, settings
│  │  ├─ backup.ts           export/import JSON versionat + validare
│  │  ├─ exportCsv.ts
│  │  ├─ exportPdf.ts
│  │  ├─ share.ts            Web Share API (salvare în Fișiere pe iOS)
│  │  └─ sources/            adaptoare de date (manual; viitor: import autorizat)
│  ├─ features/              hook-uri per funcționalitate
│  ├─ ui/
│  │  ├─ components/         Card, NumberField, SegmentedControl, VerdictBadge, Sheet ...
│  │  ├─ screens/            Dashboard, NewRide, History, Tools, Settings, Onboarding
│  │  ├─ theme/              tokeni culori/tipografie, Dark/Light/Sistem
│  │  └─ App.tsx, router
│  └─ main.tsx
├─ e2e/                      teste Playwright
└─ package.json, vite.config.ts, tsconfig.json
```

### 5.4 Modelul de date

Toate sumele de tranzacție (tarif, bacșiș, bonus, cheltuieli, costuri fixe, obiective) se
**stochează în subunități întregi** (bani: 1 RON = 100 bani) pentru a evita erori de virgulă
mobilă la însumare. Prețurile unitare și costurile vehiculului (RON/L, RON/kWh, RON/km, cost set
anvelope) rămân zecimale, pentru că au nevoie de mai mult de 2 zecimale (ex. 0,035 RON/km). Calculele intermediare folosesc numere zecimale și se
rotunjesc o singură dată, la final, la 2 zecimale (jumătate în sus, regula obișnuită), documentat în `money.ts`.

```ts
Vehicle {
  id, name, make, model,
  powertrain: 'petrol' | 'diesel' | 'lpg' | 'hybrid' | 'electric',
  // combustibil
  fuelConsumptionLPer100?: number, fuelPricePerL?: Money,
  // electric
  batteryKWh?: number, evConsumptionKWhPer100?: number,
  homePricePerKWh?: Money, publicPricePerKWh?: Money,
  homeSharePct?: number,            // public = 100 - home
  chargingLossPct?: number,         // pierderi la încărcare, opțional (0 dacă nu știi)
  // uzură și altele, per km
  tiresSetCost?: Money, tiresLifetimeKm?: number,   // -> cost anvelope/km
  maintenancePerKm: Money, depreciationPerKm: Money, otherPerKm: Money,
  archived: boolean, createdAt, updatedAt
}

Ride {
  id, startedAt, platform: 'uber' | 'bolt',
  vehicleId, source: 'manual' | 'import' ,   // punct de extensie
  fareAmount: Money, fareMode: 'gross' | 'net',      // brut (înainte de comision) sau net
  tripKm, tripMin, pickupKm, pickupMin, waitMin,
  tip: Money, bonus: Money,
  commissionPct?: number,          // suprascriere; altfel din setări
  energyCostOverride?: Money,      // dacă știi costul exact
  note?: string, tags?: string[],
  snapshot: CostSnapshot,          // valorile folosite la calcul (vezi mai jos)
  result: RideResult,              // rezultat calculat, salvat pentru viteză
  createdAt, updatedAt, deletedAt? // ștergere „moale”, recuperabilă 30 de zile
}

CostSnapshot { commissionPct, energyCostPerKm, wearCostPerKm, currency, thresholds }

Expense {
  id, date, category: 'combustibil'|'incarcare'|'service'|'spalatorie'|'parcare'|
                      'amenda'|'asigurare'|'telefon'|'contabilitate'|'alta',
  amount: Money, vehicleId?, note?, kind: 'variable' | 'fixed'
}

RecurringFixedCost { id, name, monthlyAmount: Money, active }   // RCA, CASCO, leasing, licență...

Settings {
  currency: 'RON' | ..., theme: 'system'|'light'|'dark',
  commissionPct: { uber, bolt }, activeVehicleId,
  thresholds: { redBelowPerHour, greenFromPerHour, redBelowPerKm, greenFromPerKm },
  goals: { dailyProfit, monthlyProfit },
  taxReservePct,                    // provizion setat de tine, nu calcul fiscal
  includePickupInVerdict: true,
  lastBackupAt, schemaVersion
}
```

**De ce „instantaneu” (snapshot):** dacă mâine schimbi prețul energiei, cursele de ieri trebuie
să rămână calculate cu prețul de ieri. Fiecare cursă păstrează valorile cu care a fost calculată.
Există o acțiune explicită „Recalculează cu setările curente” (pe o cursă sau pe o perioadă),
cu confirmare.

## 6. Formulele financiare (contractul pentru Etapa 3)

Notații: `c` = comision (fracție), `kmT` = km totali, `minT` = minute totale.

### 6.1 Cost vehicul pe km
```
ICE/hibrid/GPL:  energie/km = consum[L/100] / 100 × preț[L]
Electric:        preț mediu kWh = home% × preț_acasă + (1 − home%) × preț_public
                 energie/km = consum[kWh/100] / 100 × preț mediu / (1 − pierderi%)
Anvelope/km    = cost set / durată de viață [km]
Uzură/km       = anvelope/km + mentenanță/km + depreciere/km + alte/km
```

### 6.2 O cursă
```
kmT          = km cu client + km până la preluare
minT         = minute preluare + minute așteptare + minute cursă

Dacă suma e BRUTĂ:  tarif brut = sumă;             comision = tarif brut × c
Dacă suma e NETĂ:   tarif brut = sumă / (1 − c);   comision = tarif brut − sumă

Venit brut             = tarif brut + bacșiș + bonus
Venit după comision    = tarif brut − comision + bacșiș + bonus   (bacșișul și bonusul NU se comisionează)
Cost energie           = suprascriere ?? kmT × energie/km
Cost uzură/mentenanță  = kmT × uzură/km
Cost operațional mașină= cost energie + cost uzură
Cost total cursă       = comision + cost operațional mașină
Profit operațional est.= venit brut − cost total cursă
Profit / km            = profit / kmT              (indisponibil dacă kmT = 0)
Profit / oră           = profit / (minT / 60)      (indisponibil dacă minT = 0)
Cost real / km         = cost operațional mașină / kmT
Randament %            = profit / venit brut × 100 (indisponibil dacă venit = 0)
```
Niciun rezultat nu poate fi `NaN` sau `Infinity`; diviziunile la zero produc „—” în UI.
Validare: comisionul trebuie să fie între 0% și 99,9% (în modul „net”, 100% ar împărți la zero);
km, minute și sume nu pot fi negative; limite superioare rezonabile (ex. 2.000 km, 24 h) previn greșelile de tastare.

### 6.3 Verdict (praguri setate de tine)
```
ROȘU   dacă profit ≤ 0  SAU  profit/oră < prag roșu/oră  SAU  profit/km < prag roșu/km
VERDE  dacă profit/oră ≥ prag verde/oră  ȘI  profit/km ≥ prag verde/km
GALBEN altfel
```
Verdictul arată și **motivul** („sub pragul de 40 RON/oră”), nu doar culoarea.

### 6.4 Perioade (dashboard)
```
Venituri, comisioane, energie, uzură, profit operațional curse = Σ pe curse
Cheltuieli manuale (fără combustibil/încărcare)                = Σ în perioadă
Combustibil/încărcare plătit real (doar comparație)           = Σ în perioadă
Costuri fixe alocate = Σ (cost lunar × zile din perioadă ∩ lună / zile în lună)
Profit operațional al perioadei = Σ profit curse − cheltuieli manuale (fără combustibil/încărcare) − costuri fixe alocate
Rezervă taxe (opțional)         = max(0, profit perioadă) × taxReservePct
Disponibil estimat după rezervă = profit perioadă − rezervă
Ore lucrate = Σ minT / 60   (timpul dintre curse fără client nu e cunoscut în v1; vezi § 11)
```
**Decis de tine:** cheltuielile manuale de tip „combustibil/încărcare” **nu** intră în profit
(energia e deja estimată per cursă). Ele apar separat, ca „costuri reale plătite”, într-o comparație
estimat vs. real pe perioadă (diferență în RON și %), utilă pentru calibrarea consumului din setările
vehiculului. Toate celelalte cheltuieli manuale (service, spălătorie, parcare, amenzi etc.) se scad din profit.

### 6.5 Tarif minim acceptabil
```
Intrări: profit dorit/oră, viteză medie [km/h], % din km totali fără client, comision, cost mașină/km,
        opțional costuri fixe pe oră
Tarif minim / km cu client = (cost/km + (profit dorit/oră + fix/oră) ÷ viteză) / ((1 − %gol) × (1 − c))
Încasare minimă / oră de lucru  = (profit dorit/oră + fix/oră + km pe oră × cost/km) / (1 − c)
Încasare minimă / oră cu client = încasare pe oră de lucru / % timp cu client
```
Fixat și testat în Etapa 3 (`src/domain/minRate.ts`), inclusiv verificarea inversă: o tură
la tariful minim produce exact profitul dorit pe oră. Formula preliminară din Etapa 2 folosea
`× (1 + %gol)`, care subestima km goi; corect este `÷ (1 − %gol)`.

## 7. Experiența de utilizare (rezumat; detaliat în Etapa 2)

Bară de tab-uri jos, 5 poziții, butonul central proeminent:

```
 ┌─────────┬─────────┬─────────┬─────────┬─────────┐
 │ Acasă   │ Istoric │   ＋    │ Unelte  │ Setări  │
 └─────────┴─────────┴─────────┴─────────┴─────────┘
```

- **Acasă:** profit operațional azi + progres obiectiv, carduri KPI, grafic venit/profit/cheltuieli, selector perioadă.
- **＋ Cursă nouă:** platforma (ținută minte), sumă, km cursă, minute cursă, km preluare; restul ascunse sub „Mai mult” (așteptare, bacșiș, bonus, comision, energie). Cardul de verdict se actualizează la fiecare tastă. Un singur buton „Salvează”, plus „Doar simulez”.
- **Istoric:** segment Curse / Cheltuieli, căutare, filtru Uber/Bolt/vehicul/verdict, sortare după profit/oră; glisare pentru editare/ștergere cu „Anulează”.
- **Unelte:** simulare, comparare două curse, tarif minim/km, tarif minim/oră, comparație Uber vs Bolt.
- **Setări:** vehicule, comisioane, praguri verdict, obiective, costuri fixe, monedă, temă, export, backup/restaurare.
- **Prima pornire:** ghid în 3 pași (vehicul, comisioane, praguri). Câmpurile sunt **goale**, cu exemple ca text de ajutor; aplicația nu inventează valori financiare.

Ținte iOS: `viewport-fit=cover`, `env(safe-area-inset-*)` (notch/Dynamic Island, bara de jos),
fără zoom la focus (font ≥ 16px), tastatură numerică (`inputmode="decimal"`, acceptă virgulă),
ținte de atingere ≥ 44pt, icoane și splash screens pentru iOS, mod standalone.

## 8. Siguranța datelor

1. Cerere `navigator.storage.persist()` la instalare.
2. Scrieri în tranzacții Dexie; validare Zod înainte de orice scriere.
3. Migrări de schemă versionate și testate (date vechi → schemă nouă, fără pierderi).
4. Ștergere „moale” (coș 30 de zile) pentru curse și cheltuieli.
5. Backup JSON complet (cu versiune de schemă și sumă de control); restaurare cu previzualizare,
   mod „înlocuiește” sau „combină”, și backup automat al stării curente înainte de restaurare.
6. Memento de backup în aplicație dacă ultimul backup e mai vechi de N zile (N setabil).
7. Salvarea fișierelor pe iPhone prin foaia de partajare iOS (→ „Salvează în Fișiere”, iCloud Drive, e-mail).
8. Actualizări de aplicație cu mesaj „Versiune nouă disponibilă”, niciodată în mijlocul introducerii unei curse.

## 9. Extensibilitate (integrări viitoare)

- Fiecare cursă are `source`. Un adaptor implementează `RideSource { id, parse(input) → RideDraft[] }`.
- v1 are un singur adaptor: introducere manuală. Același mecanism va primi mai târziu importuri
  autorizate (ex. CSV/rapoarte descărcate de șofer din aplicațiile platformelor), fără schimbări în `domain/`.
- Stocarea e accesată doar prin repositories, deci poate fi înlocuită (ex. sincronizare) fără a atinge UI-ul.

## 10. Strategia de testare

| Nivel | Ce | Instrument |
|---|---|---|
| Formule | Fiecare formulă din § 6 cu exemple calculate de mână, cazuri limită (0 km, 0 min, 100% comision, sumă netă), invarianți (profit = venit − costuri; fără NaN) | Vitest + fast-check |
| Agregări/perioade | Granițe de zi/lună, ora de vară, alocarea costurilor fixe pe perioade parțiale | Vitest |
| Date | Migrări, backup → restaurare identic, import invalid respins | Vitest + fake-indexeddb |
| UI | Validare formulare, verdict live, filtre istoric | Testing Library |
| End-to-end | Onboarding → cursă → istoric → dashboard → export → backup/restaurare, pe profil iPhone 13 (WebKit) | Playwright |
| Pe telefon | Instalare, offline, persistență după repornire, temă, safe areas | Listă de verificare manuală (Etapa 7) |

**Exemplu de referință (va deveni test):** Bolt, tarif brut 35 RON, comision 25%, 10 km cu client,
2 km preluare, 20 min cursă + 5 min preluare + 2 min așteptare; EV 17 kWh/100 km, 70% acasă la
1,00 RON/kWh, 30% public la 2,20 RON/kWh, pierderi 0%; uzură 0,40 RON/km.
→ comision 8,75 · preț mediu 1,36 RON/kWh · energie 0,2312 RON/km × 12 km = 2,77 ·
uzură 4,80 · cost mașină 7,57 · **profit 18,68 RON** · 1,56 RON/km · **41,51 RON/oră** ·
cost real 0,63 RON/km · randament 53,4%.
(Etapa 3: rapoartele se calculează din profitul rotunjit afișat, 18,68 / 0,45 h = 41,51 —
nu din profitul nerotunjit 18,6756, care ar da 41,50. Așa cifrele de pe ecran se verifică între ele.)

## 11. Limitări cunoscute (spuse direct)

- **Timpul de așteptare între curse** (fără client, fără preluare) nu e cunoscut din curse individuale.
  v1: profitul/oră per cursă folosește timpul cursei; la nivel de zi poți introduce opțional
  „ore online” pentru un profit/oră real. Viitor: sesiuni de lucru (start/stop tură).
- **Stocare iOS:** foarte rar, iOS poate șterge datele unei aplicații web. Atenuare: § 8.
- **Fără notificări push** în v1 (nu sunt necesare pentru funcțiile cerute).

## 12. Ce rămâne de decis

**Decizii pe care le-am luat eu (le poți schimba):**
1. Suma cursei se introduce implicit ca **brut** (înainte de comision), cu comutator „net”.
2. Bacșișul și bonusul nu se comisionează.
3. Costurile fixe lunare se alocă proporțional cu zilele din perioadă.
4. Profitul/oră al cursei include timpul de preluare și așteptare.
5. Ștergerile merg întâi într-un coș de 30 de zile.

**Decizii luate de tine:**
- Bonurile reale de combustibil/încărcare servesc doar pentru comparație estimat vs. real; nu se scad din profit.

**Detalii lăsate pentru etapele următoare:** paleta exactă de culori și numele final (Etapa 2),
formula finală pentru tarif minim după teste (Etapa 3), platforma de găzduire (Etapa 7;
propunere: GitHub Pages, gratuit, HTTPS).

## 13. Plan de etape (confirmare)

1. ✅ Arhitectură (acest document)
2. Structura ecranelor și UX detaliat (`docs/UX.md`, schițe)
3. Nucleul financiar `domain/` + teste
4. Interfața completă
5. Istoric, statistici, setări, export, backup
6. Testare completă și corecturi
7. Pregătire pentru iPhone: build, găzduire, icoane, verificare pe dispozitiv
8. Instrucțiuni de instalare și utilizare
