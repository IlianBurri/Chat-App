# Hallo

Hallo ist eine Kommunikations- und Kollaborations-App für Firmen: Einzel- und Gruppenchats, Arbeitsgruppen mit Themenkanälen, Audio-/Videoanrufe, Kalender und Dateiablage an einem Ort.

> **Stand:** Meilenstein 6 von 8 – Chats, Arbeitsgruppen mit Kanälen, Aktivitätsfeed, Benachrichtigungen, globale Suche, automatischer Status, Dateien und Uploads sowie Kalender mit Besprechungsplanung. Funktionen späterer Meilensteine sind in der App als „Kommt bald“ markiert.

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
| Anna Keller | anna@example.com | Besitzerin „Produktentwicklung“ |
| Ben Müller | ben@example.com | Mitglied |
| Clara Rossi | clara@example.com | Mitglied, Status „Beschäftigt“ |
| David Meier | david@example.com | Mitglied |
| Elif Yılmaz | elif@example.com | Besitzerin „Marketing & Vertrieb“ |
| Felix Schneider | felix@example.com | Gast, Status „Nicht stören“ |

Zum Testen in Echtzeit meldest du dich in zwei Browserfenstern (z. B. einem normalen und einem privaten Fenster) mit verschiedenen Konten an.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Datenbank vorbereiten und Server + Client im Entwicklungsmodus starten |
| `npm run build` | Client für die Produktion bauen (`client/dist`) |
| `npm start` | Nur den API-Server starten (ohne Watch-Modus) |
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
| `UPLOAD_DIR` | `uploads` | Ablageort für hochgeladene Dateien (max. 25 MB pro Datei; der Ordner gehört ins Backup) |
| `ICE_SERVERS` | leer | STUN/TURN-Server für Anrufe als JSON, z. B. `[{"urls":"stun:stun.example.org:3478"}]`. Auf einem Rechner oder im LAN nicht nötig; über verschiedene Netze braucht es STUN, oft auch TURN |
| `CALL_RING_SECONDS` | `30` | So lange klingelt ein Anruf, bevor er als verpasst gilt |

## Technik

- **Client:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router, Phosphor Icons, Twemoji-Farbschrift für einheitliche Emojis, i18next (Englisch und Deutsch)
- **Server:** Node.js, Express 5, TypeScript, Socket.IO, Prisma 7 mit SQLite, zod
- **Anmeldung:** E-Mail und Passwort (bcrypt), JWT im httpOnly-Cookie; ändernde Anfragen brauchen zusätzlich den Header `X-Client: 1` (CSRF-Schutz)
- **Anrufe:** WebRTC als Mesh (jede Person direkt mit jeder, gedacht für kleine Runden bis etwa 6 Personen), Signalisierung über Socket.IO; Hintergrund-Weichzeichner mit MediaPipe Selfie Segmentation, läuft lokal im Browser

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

### App-Namen ändern

Der Anzeigename steht nur in `app.name` der Übersetzungsdateien (`client/src/i18n/locales/*.json`) und im `<title>` von `client/index.html`. Interne Bezeichnungen (Cookie, Header, CSS-Variablen, Speicher-Schlüssel) sind bewusst namensneutral.

### Weitere Sprache hinzufügen

1. `client/src/i18n/locales/en.json` nach `<code>.json` kopieren und übersetzen.
2. Die Sprache in `LANGUAGES` in `client/src/i18n/index.ts` eintragen.

### Umstieg auf PostgreSQL

Auswahlfelder sind im Schema bewusst als Text gespeichert, damit es ohne Änderungen auf PostgreSQL läuft:

1. In `server/prisma/schema.prisma` `provider = "postgresql"` setzen.
2. Den Treiberadapter in `server/src/db.ts` auf `@prisma/adapter-pg` umstellen.
3. `DATABASE_URL` auf die PostgreSQL-Verbindung setzen und `npm run dev` starten.
4. Damit die Suche Gross-/Kleinschreibung ignoriert, in `textMatch` in `server/src/routes/search.ts` `mode: 'insensitive'` ergänzen (SQLite ignoriert sie für ASCII-Buchstaben von selbst).

## Meilensteine

1. ✅ Projekt-Setup, Anmeldung, Grundlayout, Demo-Daten
2. ✅ Einzel- und Gruppenchats in Echtzeit (Reaktionen, Bearbeiten/Löschen, Lesestatus, Tippindikator, Antworten, Umfragen, @-Erwähnungen)
3. ✅ Arbeitsgruppen und Kanäle (Beiträge mit Antwort-Threads, Notizen, private Kanäle, Rollen Besitzer/Mitglied/Gast, Beitreten oder erstellen)
4. ✅ Aktivitätsfeed (Erwähnungen, Antworten, Reaktionen; filterbar, Sprung zur Nachricht), Browser-Benachrichtigungen mit Badges und Stummschalten, globale Suche (Ctrl/Cmd+K), Status „Abwesend“ nach 5 Minuten Inaktivität
5. ✅ Dateien und Uploads (Anhänge in Chats, Beiträgen und Antworten per Büroklammer, Drag & Drop oder Einfügen; Bildvorschau mit Betrachter; „Dateien“-Tabs in Chats und Kanälen; Dateien-App mit Ansichten und Filter; Downloads nur für Berechtigte)
6. ✅ Kalender und Besprechungsplanung (Tag, Arbeitswoche, Woche, Monat; planen aus dem Kalender oder per „+“ im Chat; eigener Besprechungschat mit Einladungskarte; Zusagen/Absagen, Bearbeiten, Absagen; „Teilnehmen“ ab 5 Minuten vor Beginn)
7. ✅ Audio- und Videoanrufe (aus Chats, Kanälen und Besprechungen; Lobby mit Vorschau, Geräteauswahl und Hintergrund-Weichzeichner; Klingeln mit Annehmen/Ablehnen, verpasste Anrufe; Galerie- und Sprecheransicht, Sprecher-Erkennung; Stummschalten, Kamera, Bildschirmfreigabe, Hand heben, Reaktionen, Chat im Anruf; weitere Personen dazuholen; Anrufe-App mit Verlauf und Rückruf; Status „Im Anruf“)
8. ⏳ Responsive Layout, Feinschliff, End-to-End-Tests

## Drittanbieter-Grafiken

- Icons: [Phosphor Icons](https://phosphoricons.com) (MIT-Lizenz)
- Emojis: [Twemoji](https://github.com/jdecked/twemoji) © Twitter, Inc. und weitere Mitwirkende, Grafiken unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); als Farbschrift über [twemoji-colr-font](https://github.com/mrdrogdrog/twemoji-color-font) (OFL-1.1)
- Hintergrund-Weichzeichner: Modell „Selfie Segmenter“ und [@mediapipe/tasks-vision](https://github.com/google-ai-edge/mediapipe) © Google, [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
