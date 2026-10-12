# Teamline

Teamline ist eine Kommunikations- und Kollaborations-App für Firmen: Einzel- und Gruppenchats, Arbeitsgruppen mit Themenkanälen, Audio-/Videoanrufe, Kalender und Dateiablage an einem Ort.

> **Stand:** Meilenstein 1 von 8 – Projekt-Setup, Anmeldung, Grundlayout und Demo-Daten. Funktionen späterer Meilensteine sind in der App als „Kommt bald“ markiert.

## Voraussetzungen

- Node.js **20.12 oder neuer** (getestet mit Node 24)
- npm 10+

## Schnellstart

```bash
npm install
npm run dev
```

Danach im Browser **http://localhost:5173** öffnen.

`npm run dev` erledigt beim Start alles Nötige: Es erzeugt den Prisma-Client, legt die SQLite-Datenbank an (`server/dev.db`), füllt sie beim ersten Start mit Demo-Daten und startet API-Server (Port 4000) und Web-Client (Port 5173) gemeinsam.

### Demo-Konten

Alle Demo-Konten verwenden das Passwort **`Demo1234!`**. Auf der Anmeldeseite kannst du dich auch mit einem Klick anmelden.

| Name | E-Mail | Rolle in den Demo-Daten |
|---|---|---|
| Anna Keller | anna@teamline.demo | Besitzerin „Produktentwicklung“ |
| Ben Müller | ben@teamline.demo | Mitglied |
| Clara Rossi | clara@teamline.demo | Mitglied, Status „Beschäftigt“ |
| David Meier | david@teamline.demo | Mitglied |
| Elif Yılmaz | elif@teamline.demo | Besitzerin „Marketing & Vertrieb“ |
| Felix Schneider | felix@teamline.demo | Gast, Status „Nicht stören“ |

Zum Testen in Echtzeit meldest du dich in zwei Browserfenstern (z. B. einem normalen und einem privaten Fenster) mit verschiedenen Konten an.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Datenbank vorbereiten und Server + Client im Entwicklungsmodus starten |
| `npm run build` | Client für die Produktion bauen (`client/dist`) |
| `npm start` | Server ohne Watch-Modus starten |
| `npm run db:reset` | Datenbank leeren und Demo-Daten neu einspielen |
| `npm run typecheck` | TypeScript-Prüfung für Server und Client |
| `npm run lint` | ESLint für Server und Client |
| `npm test` | Unit-Tests (Vitest) für Server und Client |

## Konfiguration

Der Server funktioniert ohne Konfiguration. Wer etwas ändern will, kopiert `server/.env.example` nach `server/.env`:

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `4000` | Port des API-Servers |
| `DATABASE_URL` | `file:./dev.db` | Datenbankverbindung |
| `JWT_SECRET` | Entwicklungswert | Schlüssel für Sitzungs-Tokens, **in Produktion Pflicht** |
| `UPLOAD_DIR` | `uploads` | Ablageort für hochgeladene Dateien |

## Technik

- **Client:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router, lucide-react, i18next (Englisch und Deutsch)
- **Server:** Node.js, Express 5, TypeScript, Socket.IO, Prisma 7 mit SQLite, zod
- **Anmeldung:** E-Mail und Passwort (bcrypt), JWT im httpOnly-Cookie; ändernde Anfragen brauchen zusätzlich den Header `X-Teamline: 1` (CSRF-Schutz)
- **Anrufe (ab Meilenstein 7):** WebRTC Peer-to-Peer, Signalisierung über Socket.IO

```
client/            Web-App (Vite)
  src/app/         Routing, Theme
  src/components/  Layout (Titelleiste, App-Leiste, Listenbereich) und UI-Bausteine
  src/features/    Fachbereiche: auth, chat, teams, …
  src/i18n/        Übersetzungen (locales/en.json, locales/de.json)
  src/stores/      Zustand-Stores
server/
  prisma/          Datenmodell (schema.prisma) und Demo-Daten (seed.ts)
  src/routes/      REST-API unter /api
  src/socket/      Echtzeit (Socket.IO)
  src/services/    Fachlogik, z. B. Anwesenheitsstatus
```

### Weitere Sprache hinzufügen

1. `client/src/i18n/locales/en.json` nach `<code>.json` kopieren und übersetzen.
2. Die Sprache in `LANGUAGES` in `client/src/i18n/index.ts` eintragen.

### Umstieg auf PostgreSQL

Auswahlfelder sind im Schema bewusst als Text gespeichert, damit es ohne Änderungen auf PostgreSQL läuft:

1. In `server/prisma/schema.prisma` `provider = "postgresql"` setzen.
2. Den Treiberadapter in `server/src/db.ts` auf `@prisma/adapter-pg` umstellen.
3. `DATABASE_URL` auf die PostgreSQL-Verbindung setzen und `npm run dev` starten.

## Meilensteine

1. ✅ Projekt-Setup, Anmeldung, Grundlayout, Demo-Daten
2. ⏳ Einzel- und Gruppenchats in Echtzeit (Reaktionen, Bearbeiten/Löschen, Lesestatus, Tippindikator)
3. ⏳ Arbeitsgruppen und Kanäle mit Threads und Rollen
4. ⏳ Aktivitätsfeed, Benachrichtigungen, Suche, automatischer Status
5. ⏳ Dateien und Uploads
6. ⏳ Kalender und Besprechungsplanung
7. ⏳ Audio-/Videoanrufe mit Bildschirmfreigabe
8. ⏳ Responsive Layout, Feinschliff, End-to-End-Tests
