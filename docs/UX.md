# Structura aplicației și experiența de utilizare — Etapa 2

> Completează [ARHITECTURA.md](ARHITECTURA.md). Schițele interactive: [mockups/ecrane.html](mockups/ecrane.html).
> Stare: **propunere, așteaptă aprobare**

---

## 1. Contextul de folosire (de aici pornesc toate deciziile)

- Telefonul e în suport pe bord, adesea noaptea, cu o singură mână liberă și câteva secunde între curse.
- Întrebarea de bază e una singură: **„merită?”**. Restul aplicației (istoric, statistici) se folosește acasă, cu timp.
- De aceea: cifre mari, contrast ridicat, ținte de atingere mari, Dark Mode ca experiență principală, Light Mode la fel de îngrijit pentru ziua în plină lumină.

## 2. Identitate vizuală

**Idee:** limbajul indicatoarelor rutiere și al bordului de mașină — clar, funcțional, lizibil de la distanță.
Nu împrumutăm culorile Uber/Bolt (sunt mărci înregistrate și ar crea confuzie); platformele apar ca etichete text.

| Token | Dark | Light | Rol |
|---|---|---|---|
| `bg` | `#121820` asfalt | `#EDF0F3` beton | fundal |
| `surface` | `#1B2430` | `#FFFFFF` | suprafețe |
| `ink` | `#E9EEF4` | `#121820` | text principal |
| `muted` | `#8A97A8` | `#5B6878` | text secundar |
| `brand` | `#3D7BFF` albastru indicator | `#1F5BE0` | acțiuni, navigare |
| `go` | `#2BC48A` | `#12915F` | cursă profitabilă |
| `slow` | `#F5B82E` | `#B07A00` | profitabilitate redusă |
| `stop` | `#F0525A` | `#C9303A` | neprofitabilă |

Culorile verdictului sunt **rezervate** pentru verdict și nu apar decorativ în altă parte, ca să rămână un semnal clar.
Verdictul nu se bazează doar pe culoare: are și text („Merită”, „La limită”, „Nu merită”) și motivul.

**Tipografie:** *Barlow* (inspirată din semnalistica rutieră) pentru tot; *Barlow Semi Condensed* cu cifre tabulare pentru numere mari.
Fonturile sunt incluse în aplicație (funcționează offline). Scară: 12 / 14 / 16 / 20 / 28 / 44 / 64.

**Formă:** colțuri rotunjite diferit după rol (bară de navigare 22, foi 18, câmpuri 12, etichete 6), fără umbre decorative;
separarea se face prin suprafețe și linii fine.

**Mișcare:** o singură animație „semnătură” — câmpul de verdict își schimbă culoarea și cifra principală se rostogolește când
modifici valorile. Restul: tranziții scurte la deschiderea foilor și la schimbarea tab-urilor. Respectă „Reducere mișcare” din iOS.

## 3. Navigare

```
 ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 │  Acasă   │ Istoric  │    ＋    │  Unelte  │  Setări  │
 └──────────┴──────────┴──────────┴──────────┴──────────┘
```
- Butonul ＋ deschide „Cursă nouă” ca foaie pe tot ecranul (se închide prin glisare în jos) — accesibil din orice tab.
- Fiecare tab își păstrează poziția de derulare și filtrele.
- Bara de navigare stă deasupra indicatorului de „acasă” al iPhone-ului (safe area).

## 4. Ecrane

### 4.1 Acasă (dashboard)
```
 Azi ▾                                     [lună/soare]
 Profit operațional estimat
 284,60 RON
 ███████████████░░░░░  71% din obiectivul de 400 RON
 ─────────────────────────────────────────────────
 Venituri 512,00   Comisioane 118,40   Costuri mașină 109,00
 Curse 14   Km 186   Ore 7,4
 Profit/cursă 20,33   Profit/km 1,53   Profit/oră 38,46
 ─────────────────────────────────────────────────
 [grafic: venit / profit / cheltuieli pe zile, atingere = detalii]
 ─────────────────────────────────────────────────
 Uber vs Bolt: profit/oră 36,1 vs 41,2
 Combustibil/încărcare: estimat 62 · plătit 70 (+13%)
```
- Selectorul de perioadă: Astăzi, Ieri, Ultimele 7 zile, Ultimele 30 de zile, Luna curentă, luni anterioare (listă), Interval personalizat.
- Pentru perioade > 1 zi, obiectivul devine cel lunar (proporțional pentru intervale).
- Sub cifra principală, o notă fixă: „Estimare operațională, nu profit contabil sau fiscal.”
- Stare goală: „Nicio cursă azi. Apasă ＋ ca să adaugi prima.”

### 4.2 Cursă nouă (cea mai importantă)
```
 [ Uber | Bolt ]                     vehicul: Tesla M3 ▾
 Sumă cursă          35,00  RON   (brut ⇄ net)
 Km cu client        10,0         Minute cursă   20
 Km până la client    2,0         Minute preluare 5
 ▸ Mai mult: așteptare, bacșiș, bonus, comision, energie, notă
 ┌───────────────────────────────────────────────┐
 │  MERITĂ                         41,50 RON/oră │   ← câmp colorat, live
 │  Profit 18,68 · 1,56 RON/km · randament 53%   │
 │  ▸ detalii calcul                             │
 └───────────────────────────────────────────────┘
 [ Doar simulez ]                    [ Salvează cursa ]
```
- Platforma și vehiculul se rețin de la ultima cursă; comisionul vine automat din setări.
- Câmpurile primesc focus în ordine, cu tastatură numerică; virgula și punctul sunt acceptate.
- Fluxul tipic: 5 valori + „Salvează” — sub 10 secunde.
- „Detalii calcul” arată fiecare rând: tarif brut, comision, venit după comision, energie, uzură, cost total, profit, profit/km, profit/oră, cost real/km, randament.
- „Doar simulez” nu salvează nimic; aceeași foaie servește pentru simularea înainte de acceptare.
- Data/ora = acum, editabilă în „Mai mult” (pentru curse adăugate mai târziu).
- După salvare: confirmare scurtă „Cursă salvată” cu „Anulează” 5 secunde, apoi formularul se golește, păstrând platforma.

### 4.3 Istoric
- Segment: **Curse | Cheltuieli**.
- Căutare (notă, sumă, dată), filtre: platformă, vehicul, verdict, perioadă; sortare: dată, profit, profit/oră, profit/km.
- Rând de cursă: oră, platformă, sumă, profit, profit/oră, bulină de verdict.
- Glisare stânga: Șterge (→ coș, cu „Anulează”); atingere: detalii + Editează.
- Antet de grup pe zi cu totalul zilei.
- Scurtături: „Cele mai bune 10” / „Cele mai slabe 10” pentru perioada aleasă.
- Cheltuieli: listă + buton „Adaugă cheltuială” (categorie, sumă, dată, vehicul, notă).

### 4.4 Unelte
1. **Simulează o cursă** — aceeași foaie ca „Cursă nouă”, fără salvare.
2. **Compară două curse** — două coloane A/B, verdict și diferențe evidențiate („B aduce +9,20 RON/oră”).
3. **Tarif minim pe km** — intrări: profit dorit/oră, viteză medie, % km fără client; rezultat cu explicație.
4. **Tarif minim pe oră** — intrări: profit dorit/oră, % timp cu client.
5. **Uber vs Bolt** — comparație pe perioadă: profit/oră, profit/km, comision mediu, număr curse.

### 4.5 Setări
- **Vehicule:** listă, adaugă/editează/arhivează, vehicul activ. Formularul se adaptează motorizării; pentru electric apare calculatorul acasă/public cu preț mediu calculat live.
- **Comisioane:** Uber %, Bolt %.
- **Praguri verdict:** roșu sub X RON/oră și Y RON/km; verde de la X' RON/oră și Y' RON/km — cu previzualizare pe cursa de referință.
- **Obiective:** profit zilnic, profit lunar.
- **Costuri fixe lunare:** listă (RCA, CASCO, leasing, licență, telefon, contabil…).
- **Rezervă pentru taxe %** (provizion, explicat).
- **Monedă, temă** (Sistem / Luminos / Întunecat), interval memento backup.
- **Date:** Export CSV, Export PDF (alegi perioada), Backup, Restaurare, Coș (curse șterse), ultima copie de rezervă: „acum 3 zile”.

### 4.6 Prima pornire
1. Bun venit + ce face aplicația (un ecran).
2. Primul vehicul (marcă, model, motorizare, consum, prețuri, costuri/km — cu explicații pentru fiecare).
3. Comisioane și praguri.
Fără valori pre-completate; textele de ajutor arată exemple. Se poate reveni oricând din Setări.

## 5. Reguli de interacțiune

- Validare la ieșirea din câmp, mesaje concrete: „Introdu km cu client (0–2.000).”
- Câmpuri obligatorii minime pentru salvare: sumă, km cu client, minute cursă. Restul pornesc de la 0.
- Orice ștergere are „Anulează” sau confirmare; restaurarea backup-ului are previzualizare.
- Toate sumele afișate cu formatul românesc (1.234,56 RON).
- Accesibilitate: contrast AA minim, Dynamic Type până la 130% fără ruperea aspectului, VoiceOver cu etichete pentru toate valorile.
