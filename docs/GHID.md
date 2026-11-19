# Ghid Drivio: instalare și utilizare

Drivio îți arată, înainte și după fiecare cursă Uber sau Bolt, cât câștigi de fapt după comision, energie, uzură și kilometrii până la client.

**Adresa aplicației:** https://dantuca5.github.io/drivio/

---

## 1. Instalare pe iPhone (o singură dată, 1 minut)

1. Deschide adresa de mai sus în **Safari**. Din Chrome sau din alt browser nu se poate instala ca aplicație pe iPhone.
2. Apasă butonul **Partajează**: pătratul cu săgeata în sus, în bara de jos a Safari.
3. Derulează și alege **„Adaugă pe ecranul principal”**.
4. Numele propus e „Drivio”. Apasă **Adaugă**.
5. Închide Safari și deschide **Drivio de pe ecranul principal**. De acum folosește doar această icoană.

**Ce trebuie să știi:**
- Aplicația pornește pe tot ecranul, ca orice aplicație din App Store.
- După prima deschidere funcționează și **fără internet**: poți salva curse, vedea statistici și face rapoarte PDF fără semnal.
- Datele tale stau **doar pe telefon**. Drivio nu are servere și nu trimite nimic pe internet.
- Datele din aplicația instalată sunt separate de cele din Safari. Dacă ai încercat aplicația întâi în Safari, configurarea se face din nou în aplicația instalată.

---

## 2. Prima configurare (5 minute)

La prima deschidere, un ghid în 3 pași îți cere datele mașinii și ale platformelor. **Nicio valoare nu e completată din oficiu**: aplicația calculează cu cifrele tale.

### Pasul 2: mașina ta

| Câmp | Ce introduci | De unde îl afli |
|---|---|---|
| Nume | Cum o recunoști (ex. „Tesla albă”) | — |
| Motorizare | Benzină, Motorină, GPL, Hibrid sau Electric | — |
| **Electric:** Consum real (kWh/100 km) | Media reală, nu cea din catalog | Calculatorul de bord, pe ultimele luni |
| **Electric:** Preț acasă (RON/kWh) | Prețul total pe kWh din factură, cu taxe | Factura de curent: total de plată ÷ kWh |
| **Electric:** Preț stații publice (RON/kWh) | Prețul mediu la stațiile pe care le folosești | Aplicația stației sau bonurile |
| **Electric:** glisorul Acasă / Stații publice | Cât la sută din energie încarci acasă | Estimare; ajustezi după primele săptămâni |
| **Electric:** Pierderi la încărcare | Opțional, lasă gol dacă nu știi | — |
| **Combustibil:** Consum mediu (L/100 km) | Media reală | Calculatorul de bord sau plinurile |
| **Combustibil:** Preț pe litru | Prețul obișnuit la pompă | — |
| Set anvelope + Rezistă (km) | Opțional: costul unui set și câți km ține | Ex. 2.000 lei pentru 40.000 km |
| **Mentenanță (RON/km)** | Revizii, frâne, filtre etc. împărțite pe km | Vezi calculul de mai jos |
| **Depreciere (RON/km)** | Cât pierde mașina din valoare pe fiecare km | Vezi calculul de mai jos |
| Alte costuri (RON/km) | Opțional, orice alt cost care crește cu km | — |

**Cum calculezi mentenanța pe km:**
Adună ce ai plătit într-un an pe revizii, plăcuțe, discuri, filtre, lichide și reparații de uzură. Împarte la câți km ai făcut în acel an.
> Exemplu: 3.000 lei pe an ÷ 30.000 km = **0,10 RON/km**

**Cum calculezi deprecierea pe km:**
Scazi din prețul de cumpărare cât crezi că vei lua pe mașină la vânzare. Împarți la câți km vei face până atunci.
> Exemplu: (150.000 lei − 75.000 lei) ÷ 300.000 km = **0,25 RON/km**

Jos în formular vezi imediat **Costul mașinii pe km**. Asta e suma pe care fiecare kilometru o „mănâncă” din profit.

**RCA, CASCO, leasing, rovinietă, licență, telefon, contabil** nu intră aici: sunt costuri lunare, nu pe km. Le adaugi după configurare, la **Setări → Costuri fixe lunare** (secțiunea 6).

### Pasul 3: comisioane și praguri

- **Comision Uber / Bolt (%):** procentul reținut de platformă din tariful cursei. Îl găsești în rapoartele săptămânale din aplicația de șofer.
- **Pragurile verdictului:** aici hotărăști când o cursă e bună pentru tine.
  - **Roșu sub … RON/oră** și **Roșu sub … RON/km:** sub oricare dintre ele, cursa e „Nu merită”.
  - **Verde de la … RON/oră** și **Verde de la … RON/km:** peste ambele, cursa e „Merită”.
  - Între ele, cursa e „La limită” (galben).
  - Dacă pierzi bani pe cursă, e mereu roșu.

> Exemplu de pornire: roșu sub 30 RON/oră și 1,00 RON/km; verde de la 40 RON/oră și 1,40 RON/km. Ajustează după cum arată săptămânile tale.

Toate valorile se pot schimba oricând din **Setări**.

---

## 3. Introducerea unei curse (sub 10 secunde)

1. Apasă butonul albastru **＋** din mijloc.
2. Alege **Uber** sau **Bolt**. Aplicația ține minte ultima platformă folosită.
3. Completează:
   - **Sumă cursă**
   - **Km cu client** și **Minute cursă**
   - **Km până la client** și **Minute până la client**
4. Cât tastezi, câmpul colorat îți arată verdictul, profitul pe oră și pe km.
5. Apasă **Salvează cursa** sau tasta **Enter**. Ai 5 secunde să apeși **Anulează**, dacă ai greșit.

### ⚠️ Sumă brută sau netă: important la Uber

- **Uber** afișează în ofertă suma **după comision** („Net of service fee”). Pentru cursele Uber deschide **„Mai mult”** și alege **„Sumă netă”**, apoi introdu suma exact cum apare.
- Dacă lași „Sumă brută” la o sumă netă, aplicația scade comisionul **încă o dată** și profitul iese mai mic decât în realitate.
- La **Bolt**, verifică în aplicația de șofer dacă suma afișată e înainte sau după comision și alege la fel.

### „Mai mult”: câmpuri opționale

| Câmp | Când îl folosești |
|---|---|
| Sumă brută / Sumă netă | Vezi mai sus |
| Minute așteptare | Când aștepți clientul la adresă |
| Comision | Doar dacă la această cursă comisionul a fost altul decât cel din setări (gol = din setări) |
| Bacșiș, Bonus | Se adaugă la venit și **nu** se scad cu comision |
| Cost energie exact | Dacă știi exact cât te-a costat energia; altfel se estimează |
| Data și ora | Pentru curse adăugate mai târziu |
| Notă | Ex. „aeroport”, „trafic”; o poți căuta apoi în istoric |

**„Detalii calcul”** arată fiecare rând: tarif, comision, energie, uzură, profit, profit/km, profit/oră, cost real pe km, randament.

---

## 4. Verifică o ofertă înainte s-o accepți

- În foaia de cursă nouă apasă **„Doar simulez”**, sau mergi la **Unelte → Simulează o cursă**.
- Introdu datele ofertei și te uiți la culoare. Nu se salvează nimic.
- Dacă o accepți, apasă **„Am acceptat-o”**: datele rămân completate și doar salvezi.

---

## 5. Acasă: cât ai câștigat

- Alege perioada: **Astăzi, Ieri, 7 zile, 30 de zile, Luna aceasta**. Din **„Altă perioadă”** ai lunile anterioare și orice interval vrei.
- **Cifra mare** e *profitul operațional estimat* al perioadei: venituri minus comisioane, energie, uzură, cheltuieli introduse și costurile fixe care revin acelei perioade.
- Sub ea vezi:
  - progresul spre obiectiv și rezerva pentru taxe, dacă le-ai setat;
  - 12 indicatori;
  - graficul pe zile (atinge o bară pentru suma zilei), Uber vs Bolt și energia estimată față de cea plătită.
- **„Exportă perioada”** face raportul PDF sau CSV pentru perioada aleasă.

> **Important:** cifrele sunt **estimări operaționale**, nu profit contabil sau fiscal. Drivio nu calculează impozite, CAS, CASS sau TVA. Pentru acestea întreabă contabilul.

---

## 6. Istoric, cheltuieli și costuri fixe

**Istoric → Curse:**
- **Caută** după notă, sumă sau dată (ex. „19.11”). Diacriticele nu contează.
- **Filtrează** după Uber/Bolt, după verdict sau după perioadă. Schimbă ordinea după profit, profit/oră, profit/km.
- **„Cele mai bune 10”** / **„Cele mai slabe 10”**: cursele cu cel mai mare / mic profit pe oră.
- **Atinge o cursă** ca s-o editezi sau s-o ștergi. La editare cursa își păstrează costurile din ziua în care a fost salvată. Bifează „Recalculează” doar dacă vrei să folosească valorile actuale.

**Istoric → Cheltuieli → Adaugă cheltuială:** service, spălătorie, parcare, amenzi etc. Acestea se scad din profitul perioadei.
- **Bonurile de combustibil și încărcare nu se scad din profit**, ca să nu numeri energia de două ori: ea e deja estimată la fiecare cursă. Bonurile reale apar separat, pe Acasă, la „Energie: estimat vs plătit”. Dacă diferența rămâne mare câteva săptămâni, corectează consumul sau prețurile din setările mașinii.
- Sumele acceptă punctul de mii: **„1.500” înseamnă 1.500 lei**.

**Setări → Costuri fixe lunare:** RCA, CASCO, leasing, rovinietă, licență, telefon, contabil.
- Pentru plăți anuale împarte la 12 (ex. RCA 1.200 lei pe an = 100 lei pe lună).
- Costul se împarte pe zile: o zi din noiembrie primește 1/30 din suma lunară.
- Când nu mai plătești un cost (ex. s-a terminat leasingul), apasă **„Oprește-l”**. Lunile trecute rămân neschimbate. „Șterge” e doar pentru costuri introduse din greșeală.

**Setări → Obiective și rezervă:**
- obiectiv zilnic și/sau lunar;
- procent din profit pus deoparte pentru taxe (un provizion ales de tine);
- după câte zile fără backup să ți se amintească.

---

## 7. Backup: fă-l săptămânal ⚠️

Datele stau doar pe telefon. iOS poate șterge, foarte rar, datele aplicațiilor web. Le pierzi sigur și dacă schimbi telefonul sau ștergi aplicația. **Singura ta copie de siguranță este backup-ul.**

**Cum faci backup:**
1. **Setări → Backup → Pregătește backup-ul**.
2. **Salvează fișierul** → alege **„Salvează în Fișiere”**, de preferat în **iCloud Drive**. Poți să-l trimiți și pe e-mail.
3. Gata. Aplicația ține minte data și îți amintește când a trecut prea mult timp.

**Cum restaurezi** (telefon nou, aplicație reinstalată sau date pierdute):
1. Instalează Drivio și treci prin ghidul de pornire, cu orice valori.
2. **Setări → Restaurează din backup → Alege fișierul de backup** (din Fișiere / iCloud Drive).
3. Verifici ce conține fișierul (câte curse, ce perioadă) și alegi:
   - **Înlocuiește tot:** pe telefon rămân exact datele din backup, inclusiv setările;
   - **Adaugă la datele actuale:** cursele din backup se adaugă la cele existente.
4. **Restaurează → Confirmă restaurarea**.

Dacă ai greșit, apasă **Anulează** imediat sau mergi la **Setări → Anulează ultima restaurare**. Înainte de orice restaurare, aplicația salvează automat datele de atunci. Un fișier deteriorat sau modificat este refuzat, fără să atingă datele de pe telefon.

**Coș:** cursele și cheltuielile șterse stau 30 de zile în **Setări → Coș**, de unde le poți restaura.

---

## 8. Rapoarte PDF și CSV

**Acasă → Exportă perioada** sau **Setări → Exportă rapoarte**:
1. alegi perioada și formatul:
   - **Raport PDF:** rezumat, Uber vs Bolt, lista curselor și a cheltuielilor;
   - **Curse CSV** / **Cheltuieli CSV:** se deschid în Excel sau Numbers (separator „;”, virgulă zecimală);
2. **Pregătește fișierul**, apoi **Salvează fișierul** → Fișiere, e-mail, WhatsApp etc.

---

## 9. Actualizări

Când apare o versiune nouă, în partea de sus apare **„Versiune nouă disponibilă – Actualizează”**. Apeși când ai timp, nu în mijlocul unei curse. Datele nu sunt afectate.

---

## 10. Probleme frecvente

| Problema | Soluția |
|---|---|
| Nu găsesc „Adaugă pe ecranul principal” | Folosești Safari? În meniul Partajează, derulează în jos; pe unele versiuni de iOS e sub „Editează acțiunile”. |
| Aplicația s-a deschis în Safari, cu bara de adrese | Ai deschis linkul, nu icoana. Deschide Drivio de pe ecranul principal. |
| Profitul la Uber pare prea mic | Probabil ai lăsat „Sumă brută” la o sumă netă. Editează cursa → Mai mult → „Sumă netă”. |
| Energia estimată diferă mult de bonuri | Corectează consumul și prețurile din Setări → vehiculul tău. Se aplică doar curselor noi; pentru cele vechi, editează cursa și bifează „Recalculează”. |
| Datele au dispărut | Restaurează ultimul backup (secțiunea 7). Fă backup săptămânal ca să nu pierzi mai mult de câteva zile. |
| Am schimbat moneda și sumele nu s-au convertit | Așa e gândit: moneda schimbă doar afișarea, nu convertește sume. |
| Nu apare „Versiune nouă” deși știu că există | Închide aplicația complet (glisează-o din lista de aplicații) și redeschide-o cu internet. |

---

## 11. Ce face și ce nu face Drivio

- ✅ Calculează profitul real estimat: comision, energie sau combustibil, uzură, depreciere, km până la client, costuri fixe.
- ✅ Funcționează offline și nu trimite datele nicăieri.
- ❌ **Nu citește automat** ofertele din Uber/Bolt în versiunea actuală: datele le introduci tu. Citirea live (ca RideGo), prin înregistrarea ecranului, e planificată ca etapă separată și cere o aplicație nativă (cont Apple Developer, 99 USD/an).
- ❌ Nu calculează impozite și nu înlocuiește evidența contabilă.
