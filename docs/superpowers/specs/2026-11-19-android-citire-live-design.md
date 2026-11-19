# Drivio Android: citirea live a ofertelor și salvarea automată a curselor

> Data: 2026-11-19 · Stare: **propunere, așteaptă aprobare** · Completează [ARHITECTURA.md](../../ARHITECTURA.md)

## 1. Intenție

Șoferul nu mai tastează nimic. Când în Uber Driver sau Bolt Driver apare o ofertă, Drivio o citește și afișează peste aplicație un panou cu verdictul: Merită / La limită / Nu merită, profit pe oră și pe km. Calculul folosește costurile și pragurile lui. Dacă acceptă cursa, ea intră singură în istoric. La final se actualizează cu suma reală, iar anulările se elimină.

Referință: RideGo pe Android, care citește ofertele prin serviciul de accesibilitate, fără să apese nimic.

## 2. Obiective, non-obiective, anti-obiective

**Obiective**
- O aplicație Android (APK) care conține tot Drivio, plus citirea live pentru Uber Driver și Bolt Driver.
- Panou cu verdictul în mai puțin de 0,5 s de la apariția ofertei, cu aceleași cifre ca în Drivio.
- Salvare automată la acceptare (pasul 1), apoi actualizare la final și eliminarea anulărilor (pasul 2).
- Se instalează gratuit, direct pe telefon, fără Magazin Play.

**Non-obiective**
- Acceptarea sau refuzarea automată a curselor, ori orice atingere în Uber/Bolt. Aplicația doar citește.
- Publicarea în Magazin Play (Google restricționează aplicațiile cu servicii de accesibilitate).
- iPhone: citirea live pe iOS rămâne o etapă separată, ulterioară.
- Orice transmitere de date pe internet.

**Anti-obiective (eșec chiar dacă „merge”)**
- Curse salvate greșit fără ca șoferul să observe.
- Panoul acoperă butoanele Accept/Respinge sau încurcă lucrul în Uber/Bolt.
- Se salvează adresele sau numele pasagerilor (date personale ale altor persoane).
- Bateria se descarcă vizibil mai repede.
- Cifrele din panou diferă de cele din Drivio pentru aceeași cursă.

## 3. Constrângeri și fapte

- Dezvoltarea se face pe Windows, fără Android Studio. APK-ul se construiește în GitHub Actions; serverul Ubuntu are Android SDK preinstalat.
- **Android 13+ blochează serviciile de accesibilitate pentru aplicațiile instalate din afara Magazinului Play** („setare restricționată”). Șoferul trebuie să o deblocheze o dată: Informații aplicație → ⋮ → „Permite setările restricționate”. Ghidul trebuie să explice asta.
- Unii producători (Xiaomi, Samsung, Huawei) opresc serviciile în fundal pentru economisirea bateriei. Ghidul trebuie să acopere asta pentru telefonul șoferului.
- Cât timp Uber/Bolt e în față, partea web (WebView) a lui Drivio e suspendată. **Calculul și verdictul pentru panou se fac în Kotlin.**
- **Ecranele Uber Driver și Bolt Driver din România nu sunt cunoscute** ca structură de accesibilitate. Pot fi ascunse parțial de accesibilitate. Fezabilitatea se dovedește întâi (pasul 0).
- **Telefonul șoferului: Samsung Galaxy S24 FE** (One UI, Android 14 sau mai nou). Se aplică „setarea restricționată” pentru accesibilitate. Samsung pune aplicațiile neutilizate „la somn”, așa că Drivio trebuie trecută la „Aplicații care nu intră niciodată în repaus” (Setări → Baterie → Limite utilizare în fundal). Ghidul descrie pașii pentru One UI.
- **Ce arată ofertele reale (capturi de la șofer, noiembrie 2026)**, folosite ca date de pornire pentru parseri:
  - **Uber Driver**:
    - categorie („Comfort”, „UberX”) și eventual „Exclusive”;
    - suma în două formate, după limba sistemului: „RON47.06” sau „39,87 RON”;
    - „Net of service fee” (deci **sumă netă**), „Cash payment”, ratingul;
    - „22 mins (17.5 km) away” (preluare), apoi adresa; „6 mins (4.1 km) trip” (cursă), apoi adresa;
    - butonul **„Confirm”** sau „Match”.
  - **Bolt Driver**:
    - categorie („Premium”);
    - „lei 15.43 (NET, tax included)” (deci **tot sumă netă**);
    - „Declining won't affect acceptance rate”;
    - numele și ratingul pasagerului;
    - două rânduri „7 min • 2.9 km” (preluare) și „9 min • 3.2 km” (cursă), fiecare urmat de adresă;
    - „Current dropoff” și butonul **„Accept next ride”** când oferta vine în timpul unei curse.
  - Ambele platforme afișează deci **suma netă** (după comision). Profitul se calculează direct din ea, fără să mai scadă un comision.

## 4. Abordări considerate

| Abordare | Decizie |
|---|---|
| **Capacitor (Drivio web împachetat) + componentă nativă Kotlin** | **Aleasă**: refolosește interfața, istoricul, statisticile, exportul, backup-ul și testele |
| Aplicație complet nativă, scrisă de la zero | Respinsă: dublează tot ce există |
| Aplicația din Chrome + aplicație separată doar pentru citire | Respinsă: o aplicație nativă nu poate scrie în datele aplicației din Chrome |
| Salvare la acceptare fără actualizare (varianta 1) | Respinsă de șofer: vrea profitul real |
| **Salvare la acceptare + actualizare la final (varianta 2), în doi pași** | **Aleasă de șofer** |

## 5. Arhitectura

```
 Uber Driver / Bolt Driver (pe ecran)
        │ evenimente de accesibilitate (text, id-uri de elemente)
        ▼
 ┌─────────────── Kotlin (rulează și cu Uber în față) ───────────────┐
 │ DrivioAccessibilityService                                        │
 │   ├─ ScreenReader: textele din fereastră, cu limită de timp/rată  │
 │   ├─ UberParser / BoltParser: ecran → Ofertă | Cursă în desfășurare│
 │   │                               | Final de cursă | Anulare | — │
 │   ├─ RideCalc.kt: calculul cursei + verdict (port 1:1 din TS)     │
 │   ├─ OverlayPanel: panoul cu verdictul (fereastră de accesibilitate)│
 │   ├─ RideTracker: mașina de stări ofertă → acceptată → finalizată  │
 │   ├─ RideQueue: coadă persistentă de evenimente pentru Drivio     │
 │   └─ CaptureRecorder: modul „înregistrează” pentru dezvoltare     │
 │ CostSettingsStore: costurile și pragurile primite din Drivio      │
 └───────────────▲───────────────────────────────┬───────────────────┘
                 │ syncSettings()                 │ drainQueue()
 ┌───────────────┴──── Drivio (web, în WebView) ──▼───────────────────┐
 │ LiveReaderPlugin (Capacitor) · features/liveReader.ts               │
 │ trimite setările la fiecare schimbare; la deschidere/revenire       │
 │ preia evenimentele din coadă → saveRide / update / coș              │
 └────────────────────────────────────────────────────────────────────┘
```

### 5.1 Citirea ecranului
- Serviciul ascultă doar pachetele Uber Driver și Bolt Driver. Id-urile exacte se confirmă în pasul 0; candidați: `com.ubercab.driver`, `ee.mtakso.driver`.
- Ascultă evenimentele de schimbare a ferestrei și a conținutului. Prelucrarea are loc la cel mult 150 ms după ultimul eveniment, ca să nu descarce bateria.
- Fiecare ecran devine o listă de `ScreenNode(text, contentDescription, viewId, className, bounds)`. Parserii lucrează doar pe această listă: sunt funcții pure, testabile pe calculator cu fișierele înregistrate.

### 5.2 Parserii
- Ieșirea parserului pe un ecran: `Offer(platform, fareMinor, fareMode, pickupMin, pickupKm, tripMin, tripKm, product)`, `OnTrip`, `TripEnd(fareMinor?, durationMin?, distanceKm?)`, `Cancelled` sau nimic.
- **Uber**:
  - suma: „RON47.06” sau „39,87 RON”, cu punct sau virgulă zecimală (cu „Net of service fee” → `fareMode = net`);
  - „N mins (X km) away” → preluare; „N mins (X km) trip” → cursă;
  - se acceptă și variantele în română.
- **Bolt**:
  - suma: „lei 15.43” (cu „NET” → `fareMode = net`);
  - primul rând „N min • X km” după pasager/„Current dropoff” → preluare; al doilea → cursă.
- **„Current dropoff” / „Accept next ride”** marchează o ofertă primită în timpul unei curse (vezi 5.5).
- Regulile de mai sus vin din capturi de ecran. Textul exact pe care îl vede serviciul de accesibilitate se confirmă în pasul 0.
- **Adresele, numele și ratingul pasagerului nu se extrag și nu se salvează.**

### 5.3 Calculul în Kotlin
- `RideCalc.kt` reproduce exact `calculateRide`, `evaluateVerdict` și regulile de rotunjire din `src/domain`.
- **Paritate garantată**: un script generează `shared/calc-cases.json` (sute de cazuri, inclusiv cele aleatorii din testele de proprietăți), cu intrări și rezultatele calculate de codul TypeScript. Testele JUnit trebuie să obțină exact aceleași cifre. Orice schimbare de formulă în TS fără schimbarea în Kotlin pică testul.

### 5.4 Panoul cu verdictul
- Fereastră de tip accesibilitate, fără permisiune separată. Stă sus, sub bara de stare, departe de butoanele Uber/Bolt, care sunt jos. Se poate muta prin tragere, iar poziția se ține minte.
- Conținut (același limbaj vizual ca în Drivio): cuvântul verdictului și culoarea, platforma, suma ofertei; trei casete: **profit/oră**, **profit/km**, **profit net**; un rând „client X km · Y min · cursă X km · Y min” și o linie cu motivul verdictului.
- Spre deosebire de alte aplicații, la care „lei/km” și „lei/oră” înseamnă *încasare* pe km și pe oră, Drivio arată *profit* pe km și pe oră, după energie și uzură. Etichetele trebuie să spună clar „profit”.
- Apare la ofertă și dispare când oferta dispare. Nu primește focus și nu interceptează atingeri în afara lui.
- Dacă oferta nu poate fi citită complet, panoul arată „Ofertă necitită” în gri, nu un verdict greșit.
- Dacă Drivio n-a trimis încă setările (aplicația n-a fost deschisă după instalare sau după ghidul de pornire), panoul arată „Deschide Drivio o dată” și nu salvează nimic.
- Calculul folosește **vehiculul activ** din Drivio în momentul sincronizării. Schimbarea vehiculului activ se trimite imediat serviciului.

### 5.5 Urmărirea cursei (mașina de stări)

```
 Inactiv ──ofertă citită──► OfertăAfișată ──ecran „spre client / în cursă” în ≤ 20 s──► Acceptată
    ▲                          │                                                     │
    └──ofertă dispărută, fără ecran de cursă (refuzată/expirată)──┘                  │
                                                     ┌───── ecran de final ──────────┤ (pasul 2)
                                                     ▼                               ▼
                                               Finalizată                       Anulată (pasul 2)
```
- **Acceptată** → eveniment `ride.accepted` în coadă: datele ofertei, ora acceptării, platforma și un id unic.
- **Finalizată** (pasul 2) → `ride.completed` cu id-ul cursei și suma reală (+ timp/distanță, dacă apar).
- **Anulată** (pasul 2) → `ride.cancelled`.
- Semnalele exacte pentru „spre client”, „final” și „anulare” se stabilesc din capturi, pentru fiecare platformă.
- **Oferte primite în timpul unei curse** (Uber trimite oferta următoare înainte de final): se urmăresc separat. O astfel de ofertă e „acceptată” când apare ecranul ei de preluare. Cursa curentă își continuă urmărirea până la final.
- **Uber și Bolt pornite simultan**: fiecare platformă are propria mașină de stări. Panoul arată oferta ultimei aplicații din față.

### 5.6 Coada și preluarea în Drivio
- Coada stă într-un fișier JSON în spațiul privat al aplicației, scris atomic. Nu se pierde la închiderea aplicației sau la repornirea telefonului.
- Drivio citește coada la pornire și la fiecare revenire în prim-plan. Pentru fiecare eveniment:
  - `ride.accepted` → cursă nouă cu `source: 'auto'`, `status: 'estimated'`, `externalId`. Calculul folosește setările din momentul acceptării (instantaneu, ca la cursele manuale).
  - `ride.completed` → actualizează suma, plus timpul și distanța dacă există, și pune `status: 'final'`. Instantaneul de costuri rămâne cel inițial.
  - `ride.cancelled` → cursa merge în coș (recuperabilă 30 de zile).
- Fiecare eveniment are un id; reluarea aceluiași eveniment nu dublează nimic (idempotent). Evenimentele se șterg din coadă doar după ce Drivio le-a salvat.
- În istoric, cursele automate au eticheta **„Auto”** și, până la final, **„estimată”**. Se pot edita și șterge ca orice cursă.

### 5.7 Schimbări în Drivio (web)
- `RideEntity`: `source: 'manual' | 'import' | 'auto'`, `status: 'estimated' | 'final'` (cursele manuale sunt `final`), `externalId?`. Migrare de bază de date **v3** și versiunea 3 a formatului de backup, compatibilă cu backup-urile v1 și v2.
- Setări → **„Citire automată (Android)”** (vizibilă doar în aplicația Android):
  - starea serviciului;
  - pașii de activare, cu butoane care deschid setările Android;
  - panou pornit/oprit;
  - salvare automată pornită/oprită;
  - modul „înregistrează” și „Trimite înregistrările”.
- Setarea pe platformă „suma din ofertă e brută / netă”, **implicit netă pentru Uber și Bolt** (conform capturilor). Se aplică și la introducerea manuală, unde „Sumă cursă” pornește pe sumă netă. Rezolvă și problema deschisă din Etapa 7. **Această parte se poate livra imediat și în aplicația web, independent de Android.**

### 5.8 Modul „înregistrează” (pentru dezvoltare)
- Pornit din setări, salvează fiecare ecran Uber/Bolt citit (lista de `ScreenNode`, fără imagini), marcat cu ora.
- **Înainte de salvare, textele care arată ca adrese, nume sau numere de telefon sunt înlocuite cu „[ascuns]”**, iar șoferul vede fișierul înainte să-l trimită.
- „Trimite înregistrările” deschide foaia de partajare Android (e-mail, WhatsApp, Drive).

## 6. Construire, instalare, actualizare
- `android/`: proiectul Capacitor, salvat în git. Partea nativă stă într-un modul Kotlin separat.
- GitHub Actions `android.yml`:
  - instalează Java 21 și Node;
  - rulează testele web și testele JUnit;
  - construiește APK-ul semnat;
  - îl publică într-o versiune GitHub („Releases”).
- **Cheia de semnare** se generează o singură dată și stă în secretele depozitului, cu o copie de rezervă la șofer. Fără ea, actualizările nu se mai pot instala peste aplicația existentă și datele s-ar pierde la reinstalare.
- Instalare: pe telefon, din pagina „Releases”, descarci APK-ul, permiți instalarea din browser, instalezi. Actualizările se instalează peste, iar datele rămân.
- Mutarea datelor din aplicația din Chrome: backup acolo, restaurare în aplicația Android.

## 7. Pași de livrare
| Pas | Ce primește șoferul | Criteriu de reușită |
|---|---|---|
| **0. Fezabilitate** | APK cu Drivio complet + serviciul de accesibilitate doar în modul „înregistrează” | Pe telefonul șoferului se văd în înregistrări suma, km și minutele ofertei, pentru Uber și Bolt. **Dacă nu se văd, ne oprim și reevaluăm** (alternativa: înregistrarea ecranului + recunoaștere de text). |
| **1. Live + salvare la acceptare** | Panoul cu verdictul + salvare automată „estimată” | Pe 20 de oferte reale: citire corectă la ≥ 95%, zero curse salvate greșit, panou în < 0,5 s |
| **2. Final de cursă și anulări** | Actualizare cu suma reală + eliminarea anulărilor | Pe o zi de lucru: toate cursele finalizate au status „final” și suma reală |

## 8. Testare
- **JUnit**: parserii pe ecranele înregistrate (fiecare captură devine un test), mașina de stări pe secvențe reale de ecrane, paritatea calculului pe `calc-cases.json`.
- **Vitest**: preluarea din coadă (idempotență, actualizare, anulare), migrarea v3, backup v3 și importul v1/v2.
- **Pe telefon**: o listă de verificare manuală pentru fiecare pas, completată de șofer.
- Ce nu pot testa eu: Uber/Bolt reale. Nu rulează fără cont de șofer și locație reală. Toată verificarea pe ecranele reale depinde de înregistrările șoferului.

## 9. Riscuri
- **Termenii Uber/Bolt**: nu sunt verificați. RideGo funcționează public pe aceeași metodă, dar contul e al șoferului; decizia de folosire îi aparține.
- **Schimbări de ecran în Uber/Bolt** strică citirea. Atenuare: panoul arată „Ofertă necitită” în loc de verdict greșit, salvarea automată se oprește la date incomplete, iar parserii se actualizează din înregistrări noi.
- **Play Protect** poate avertiza la instalarea unui APK cu serviciu de accesibilitate. E normal pentru aplicații instalate direct; ghidul explică.
- **Ecran ascuns de accesibilitate**: îl află pasul 0, înainte de investiția mare.

## 10. Decizii luate de mine (le poți schimba)
1. Panoul stă sus pe ecran.
2. Fereastra în care oferta trebuie urmată de ecranul de cursă ca să fie „acceptată” este de 20 de secunde.
3. Modul „înregistrează” ascunde automat adresele și numele.
4. O cursă salvată automat se poate șterge sau edita ca oricare alta.
5. Distribuirea se face prin GitHub Releases.

## 11. Confidențialitate
- Capturile primite de la șofer conțin nume de pasageri și adrese. Ele servesc doar la descrierea formatului și **nu se salvează în depozit**. În teste se folosesc texte cu nume și adrese inventate.

## 12. Ce rămâne pentru constructor
- Semnalele exacte ale ecranelor (din capturi), detaliile de stil ale panoului, intervalele de limitare a ratei, structura modulului Kotlin.
