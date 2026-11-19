# Drivio

Calculator de profitabilitate pentru șoferii Uber și Bolt din România. Arată în câteva secunde dacă o cursă merită, după comision, energie sau combustibil, uzură, depreciere și kilometrii până la client, și ține evidența profitului pe zi, săptămână și lună.

**Aplicația:** https://dantuca5.github.io/drivio/ · **Ghid de instalare și utilizare:** [docs/GHID.md](docs/GHID.md)

- Instalabilă pe iPhone din Safari („Adaugă pe ecranul principal”), funcționează offline.
- Datele rămân doar pe telefon; backup și restaurare prin fișier.
- Temă întunecată și luminoasă, export PDF și CSV, obiective, cheltuieli, costuri fixe.
- Toate cifrele sunt **estimări operaționale**, nu profit contabil sau fiscal.
- **Android (în lucru):** aplicație APK care citește singură ofertele Uber și Bolt. Instalare: [docs/ANDROID.md](docs/ANDROID.md).

## Pentru dezvoltare

| Comandă | Ce face |
|---|---|
| `npm install` | Instalează dependențele |
| `npm run dev` | Pornește aplicația local |
| `npm test` | Testele unitare și de interfață (Vitest) |
| `npm run typecheck` | Verificarea de tipuri (TypeScript) |
| `npm run e2e` | Testele cap-coadă în WebKit, profil iPhone 13 Pro (Playwright) |
| `npm run build` | Build-ul de producție, cu lucrătorul offline |

Fiecare modificare pe ramura `main` e testată și publicată automat pe GitHub Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). APK-ul Android se compilează și se testează (inclusiv testele Kotlin) în [.github/workflows/android.yml](.github/workflows/android.yml); proiectul nativ e în [android](android) (Capacitor + Kotlin).

## Structură

- [src/domain](src/domain): calculele financiare. TypeScript pur, fără interfață sau stocare, acoperit de teste.
- [src/services](src/services): baza de date locală (IndexedDB, Dexie), backup, export CSV/PDF.
- [src/features](src/features): logica formularelor și a filtrelor.
- [src/ui](src/ui): ecranele și componentele React.
- [docs](docs): [arhitectura](docs/ARHITECTURA.md), [experiența de utilizare](docs/UX.md), [ghidul](docs/GHID.md).
