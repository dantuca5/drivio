# Android pasul 0 (fezabilitate): plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un APK Drivio pentru Android (Samsung S24 FE) care conține aplicația completă plus un serviciu de accesibilitate în modul „înregistrează”. Serviciul salvează textul ecranelor Uber/Bolt, cu adresele și numele ascunse, ca să putem scrie parserii.

**Architecture:** Capacitor împachetează build-ul web existent. Un modul Kotlin adaugă `DrivioAccessibilityService`, care doar înregistrează, și pluginul Capacitor `LiveReader`. Funcțiile Kotlin pure (aplatizarea ecranului și ascunderea datelor personale) sunt testate cu JUnit. APK-ul se compilează în GitHub Actions; local nu există Java 17+ și nici Android SDK.

**Tech Stack:** Capacitor 7+, Kotlin, JUnit 4, GitHub Actions (Java 21, Android SDK de pe runner).

**Spec:** [docs/superpowers/specs/2026-11-19-android-citire-live-design.md](../specs/2026-11-19-android-citire-live-design.md) § 3, 5.1, 5.7, 5.8, 6, 7 (pasul 0).

## Global Constraints
- appId: `io.github.dantuca5.drivio`; numele afișat: „Drivio”.
- Pachete urmărite: `com.ubercab.driver`, `ee.mtakso.driver`.
- Serviciul **nu face nicio acțiune** în aplicațiile urmărite (nu folosește `performAction`, gesturi sau clicuri).
- Nimic nu pleacă de pe telefon decât prin foaia de partajare, la cererea șoferului.
- Înregistrările: adresele, numele și telefoanele se înlocuiesc cu `[ascuns]` **înainte** de scrierea pe disc.
- Fișierele de înregistrare au o limită de 5 MB în total; cele mai vechi se șterg primele.

## Review Focus
1. Text de adresă fără cuvânt-cheie de stradă („DJ123B 45, Satu Inventat”) → trebuie ascuns (conține „, ” urmat de o localitate).
2. Pasager „Mirela • 5.0” → numele se ascunde, ratingul rămâne.
3. Sume și distanțe („lei 15.43 (NET, tax included)”, „22 mins (17.5 km) away”, „7 min • 2.9 km”) → **nu** se ascund.
4. Ecranul se schimbă de 30 de ori pe secundă → se salvează cel mult o instantanee pe secundă și doar dacă textul s-a schimbat.
5. Serviciul nu e activat → secțiunea din Setări arată pașii, nu o eroare.

---

### Task 1: Suma netă implicită pe platformă (web)
**Files:** `src/services/entities.ts`, `src/services/repositories.ts`, `src/services/backup.ts`, `src/ui/screens/RideSheet.tsx`, `src/ui/forms/FinancialForm.tsx`, teste.
**Produces:** `AppSettings.fareModeByPlatform?: Record<Platform, FareMode>` (opțional, deci fără migrare: lipsa valorii înseamnă „net”, prin `offerFareMode()`). Formularul de cursă nouă pornește cu `fareMode = settings.fareModeByPlatform[platform]` și se schimbă odată cu platforma. FinancialForm are un comutator brut/net pentru fiecare platformă.
- [x] Teste: setări noi `net/net`, setări vechi fără câmp → „net”; o cursă nouă Uber pornește pe „Sumă netă”; backup v2 restaurat primește valorile implicite; în FinancialForm comutatorul se salvează.

### Task 2: Proiectul Android (Capacitor)
**Files:** `capacitor.config.ts`, `android/**` (generat), `package.json`.
- [x] `npm i @capacitor/core @capacitor/android` și `npm i -D @capacitor/cli`; `npx cap init Drivio io.github.dantuca5.drivio --web-dir dist`; `npx cap add android`.
- [x] Lucrătorul offline (service worker) nu se înregistrează în aplicația nativă (`Capacitor.isNativePlatform()`).

### Task 3: Serviciul de înregistrare (Kotlin)
**Files:** `android/app/src/main/java/io/github/dantuca5/drivio/live/{ScreenNode.kt, Redactor.kt, CaptureStore.kt, DrivioAccessibilityService.kt, LiveReaderPlugin.kt}`, `res/xml/drivio_accessibility.xml`, `AndroidManifest.xml`, `MainActivity.kt`, `res/xml/file_paths.xml`, `app/build.gradle` (dependență JUnit), `src/test/.../RedactorTest.kt`.
**Produces:**
- `data class ScreenNode(text: String?, desc: String?, viewId: String?, cls: String?, l: Int, t: Int, r: Int, b: Int)`;
- `object Redactor { fun redact(s: String): String }`;
- `CaptureStore(dir: File, maxBytes = 5_000_000)` cu `append(pkg, nodes)`, `stats()`, `files()`, `clear()`;
- pluginul `LiveReader` cu `getStatus()`, `openAccessibilitySettings()`, `openAppDetails()`, `setCaptureEnabled({enabled})`, `shareCaptures()`, `clearCaptures()`.
- [x] JUnit: exemplele din Review Focus 1–3; telefon „0722 123 456” ascuns; „Strada Exemplu 33, Timișoara” ascuns.

### Task 4: Secțiunea „Citire automată (Android)” în Setări (web)
**Files:** `src/services/liveReader.ts` (punte tipizată spre plugin, cu variantă inactivă în afara Android), `src/ui/screens/SettingsScreen.tsx` (secțiune nouă), test jsdom cu puntea simulată.
- [x] Secțiunea apare doar pe Android. Arată starea serviciului, cei 3 pași de activare pentru Samsung (setări restricționate, accesibilitate, baterie), comutatorul de înregistrare, numărul de ecrane înregistrate, plus „Trimite” și „Șterge”.

### Task 5: Compilarea pe GitHub
**Files:** `.github/workflows/android.yml`.
- [x] Pe ramura `android` și pe `main`: Java 21, Node 24, `npm ci`, `npx tsc --noEmit`, `npx vitest run`, `npx vite build`, `npx cap sync android`, `./gradlew testDebugUnitTest assembleRelease`. APK-ul se semnează cu cheia din secretele `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Fără secrete se construiește doar o versiune de test (`assembleDebug`), marcată ca atare.
- [ ] Pe `main`, APK-ul semnat se publică în GitHub Releases ca `drivio.apk`.

### Task 6: Verificare
- [x] Local: `npx tsc --noEmit`, `npx vitest run`, `npx playwright test` trec.
- [x] GitHub: rularea Android trece (inclusiv JUnit), iar APK-ul există.
