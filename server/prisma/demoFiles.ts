/** Generated demo attachments: images (SVG) and text documents. */

const swatches = ['#5B5FC7', '#7F85F5', '#C4314B', '#0F7B6C', '#B35C00', '#2B7CD3'];

const palette = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#1F1F2E"/>
  <text x="48" y="80" font-family="Segoe UI, sans-serif" font-size="36" font-weight="600" fill="#FFFFFF">Farbpalette Dunkelmodus</text>
  ${swatches
    .map(
      (c, i) => `<rect x="${48 + (i % 3) * 296}" y="${120 + Math.floor(i / 3) * 200}" width="272" height="150" rx="12" fill="${c}"/>
  <text x="${64 + (i % 3) * 296}" y="${300 + Math.floor(i / 3) * 200}" font-family="Consolas, monospace" font-size="20" fill="#E0E0F0">${c}</text>`,
    )
    .join('\n  ')}
</svg>`;

const icons = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
  <rect width="720" height="360" fill="#F5F5FA"/>
  <text x="40" y="60" font-family="Segoe UI, sans-serif" font-size="28" font-weight="600" fill="#242424">Einstellungen – Icons</text>
  <g fill="none" stroke="#5B5FC7" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="120" cy="200" r="50"/><circle cx="120" cy="200" r="18"/>
    <path d="M270 160h100M270 200h100M270 240h100"/><circle cx="300" cy="160" r="10"/><circle cx="340" cy="200" r="10"/><circle cx="310" cy="240" r="10"/>
    <path d="M470 150a50 50 0 0 1 80 40v30l15 20h-110l15-20v-30a50 50 0 0 1 0-40z"/><path d="M500 255a15 15 0 0 0 30 0"/>
    <rect x="600" y="150" width="70" height="100" rx="10"/><path d="M620 180h30M620 205h30M620 230h18"/>
  </g>
</svg>`;

const architecture = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">
  <rect width="900" height="420" fill="#FFFFFF"/>
  <g font-family="Segoe UI, sans-serif" font-size="22" text-anchor="middle">
    <rect x="40" y="160" width="220" height="100" rx="12" fill="#E8EBFA" stroke="#5B5FC7" stroke-width="3"/>
    <text x="150" y="218" fill="#242424">Web-Client</text>
    <rect x="340" y="160" width="220" height="100" rx="12" fill="#E8EBFA" stroke="#5B5FC7" stroke-width="3"/>
    <text x="450" y="205" fill="#242424">API + Socket.IO</text><text x="450" y="235" font-size="16" fill="#616161">Express</text>
    <rect x="640" y="160" width="220" height="100" rx="12" fill="#DFF6DD" stroke="#0F7B6C" stroke-width="3"/>
    <text x="750" y="218" fill="#242424">Datenbank</text>
  </g>
  <g stroke="#616161" stroke-width="3" marker-end="url(#a)"><path d="M262 210h70"/><path d="M562 210h70"/></g>
  <defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0l10 5-10 5z" fill="#616161"/></marker></defs>
  <text x="450" y="80" font-family="Segoe UI, sans-serif" font-size="30" font-weight="600" text-anchor="middle" fill="#242424">Architektur-Übersicht</text>
</svg>`;

const goals = `# Ziele Q4

1. Neukunden: 12 Abschlüsse im Mittelstand
2. Kampagne «Herbst» mit 3 Webinaren
3. Kundenzufriedenheit (NPS) über 45

Verantwortlich: Elif Yılmaz
`;

const notes = `Gesprächsnotizen Nordwind AG

- Kalender: Wochenansicht wirkt überladen, Monatsansicht gewünscht
- Besprechungen: Teilnehmen-Button soll früher erscheinen
- Nächster Termin: Demo in zwei Wochen
`;

export const demoFiles = [
  { name: 'Farbpalette-Dunkelmodus.svg', storedName: 'seed-farbpalette.svg', mimeType: 'image/svg+xml', content: palette, uploader: 'clara', target: 'palette', hoursAgo: 20 },
  { name: 'Einstellungen-Icons.svg', storedName: 'seed-icons.svg', mimeType: 'image/svg+xml', content: icons, uploader: 'clara', target: 'icons', hoursAgo: 72 },
  { name: 'Architektur-Übersicht.svg', storedName: 'seed-architektur.svg', mimeType: 'image/svg+xml', content: architecture, uploader: 'david', target: 'general', hoursAgo: 30 },
  { name: 'Q4-Ziele.md', storedName: 'seed-q4-ziele.md', mimeType: 'text/markdown', content: goals, uploader: 'elif', target: 'goals', hoursAgo: 28 },
  { name: 'Nordwind-Notizen.txt', storedName: 'seed-nordwind.txt', mimeType: 'text/plain', content: notes, uploader: 'felix', target: 'feedback', hoursAgo: 3 },
] as const;
