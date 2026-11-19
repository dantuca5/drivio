# Drivio pe Android (Samsung Galaxy S24 FE)

Aplicația Android conține tot Drivio, plus **citirea automată** a ofertelor din Uber Driver și Bolt Driver. Citirea se face prin serviciul de accesibilitate al telefonului. Drivio doar citește: nu apasă nimic în locul tău și nu trimite nimic pe internet.

> **Versiunea de acum (pasul 0)** doar **înregistrează** ecranele Uber și Bolt, cu numele, adresele și telefoanele ascunse. Din aceste înregistrări învățăm formatul exact al ofertelor. Panoul cu verdictul peste ofertă vine în pasul 1.

## 1. Instalare

1. Pe telefon, deschide pagina **Releases** a proiectului: https://github.com/dantuca5/drivio/releases
2. La cea mai nouă versiune „Drivio Android”, apasă **drivio.apk** și descarcă fișierul.
3. Deschide fișierul descărcat. Prima dată, Android cere voie să instaleze aplicații din browser: **Setări → Permite din această sursă**, apoi înapoi și **Instalează**.
4. Play Protect poate avertiza că aplicația nu e cunoscută. Apasă **Mai multe detalii → Instalează oricum**.

Versiunile noi se instalează la fel, peste cea veche. Datele rămân.

## 2. Mută-ți datele din aplicația web

Aplicația Android are propria bază de date, separată de cea din browser.

1. În Drivio din browser: **Setări → Fă backup acum** și salvează fișierul.
2. În Drivio pe Android: treci de ghidul de pornire, apoi **Setări → Restaurează din backup** și alege fișierul.

## 3. Pornește citirea automată

În Drivio: **Setări → Citire automată (Android)**. Fiecare pas are un buton care deschide ecranul potrivit.

1. **Permite setările restricționate.** Android 13+ blochează accesibilitatea la aplicațiile instalate din afara Magazinului Play. Apasă **Deschide informațiile aplicației**, apoi **⋮** (sus, dreapta) → **Permiteți setările restricționate** și confirmă cu amprenta sau PIN-ul.
   - Dacă meniul ⋮ nu apare, încearcă întâi pasul 2 o dată (Android arată un mesaj că setarea e restricționată), apoi revino aici.
2. **Pornește serviciul.** Apasă **Deschide Accesibilitate** → **Aplicații instalate** → **Drivio – citire curse** → **Activat** → **Permiteți**.
3. **Nu lăsa telefonul să-l oprească.** Samsung oprește aplicațiile pe care nu le deschizi des. Apasă **Deschide setările bateriei**, sau mergi în **Setări → Baterie → Limite de utilizare în fundal → Aplicații care nu intră niciodată în repaus → +** și adaugă **Drivio**.

Când totul e gata, în Drivio scrie **„Serviciul e pornit”**.

## 4. Înregistrează ofertele (pasul 0)

1. Bifează **Înregistrează ecranele Uber și Bolt**.
2. Lucrează normal câteva ore, cu ambele aplicații. Ideal: oferte acceptate, oferte refuzate, o cursă dusă până la capăt și, dacă se întâmplă, o anulare.
3. În Drivio, la **Citire automată**, vezi câte ecrane s-au înregistrat. Apasă **Trimite** și alege cum (e-mail, WhatsApp, Drive).
4. După ce le-ai trimis, apasă **Șterge**. Înregistrările ocupă cel mult 5 MB; când se umple spațiul, cele mai vechi se șterg singure.

**Ce conține o înregistrare:** textele de pe ecranul Uber/Bolt (sume, distanțe, minute, butoane) și poziția lor pe ecran. Numele, adresele, telefoanele și e-mailurile se înlocuiesc cu `[ascuns]` înainte de salvare. Verifică totuși fișierul înainte să-l trimiți cuiva.

## Probleme

| Problemă | Ce faci |
|---|---|
| „Drivio – citire curse” e gri și nu se poate activa | Fă pasul 1 (setările restricționate). |
| Serviciul se oprește singur după o vreme | Fă pasul 3 (baterie). După o actualizare a aplicației, verifică din nou pasul 2. |
| Numărul de ecrane înregistrate nu crește | Verifică bifa de la „Înregistrează” și că ești în Uber Driver sau Bolt Driver. Dacă scrie „Nu găsesc pe telefon”, spune-ne: aplicația ta de șofer are alt nume de pachet. |
| Nu se instalează versiunea nouă peste cea veche | Versiunile de test nesemnate nu se pot actualiza. Fă backup, dezinstalează, instalează, restaurează. |
