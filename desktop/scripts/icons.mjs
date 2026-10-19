// Renders the app, tray and badge icons from the logo into build/ (run: node scripts/icons.mjs).
// Uses Playwright's Chromium from the repository root. The PNGs are committed; run this again only after
// changing the logo. electron-builder derives the Windows .ico and macOS .icns from build/icon.png.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../../package.json', import.meta.url))('@playwright/test');

const ACCENT = '#5B5FC7';
const RED = '#C4314B';
// The logo's white parts in a 32×32 box (same as client/public/favicon.svg).
const glyph = (fill) => `
  <path d="M11.5 5H20.5A3.5 3.5 0 0 1 24 8.5V11.5A3.5 3.5 0 0 1 20.5 15H18L16 18L14 15H11.5A3.5 3.5 0 0 1 8 11.5V8.5A3.5 3.5 0 0 1 11.5 5Z" fill="${fill}"/>
  <path d="M8 23H24" stroke="${fill}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <circle cx="8" cy="23" r="2.6" fill="${fill}"/>
  <circle cx="16" cy="23" r="2.6" fill="${fill}"/>
  <circle cx="24" cy="23" r="2.6" fill="${fill}"/>`;
const tile = `<rect width="32" height="32" rx="8" fill="${ACCENT}"/>${glyph('#fff')}`;

const icons = {
  // App icon: rounded tile with a margin, as macOS expects; Windows and Linux look fine with it too.
  'icon.png': { size: 1024, viewBox: '-3.88 -3.88 39.77 39.77', body: tile },
  'tray.png': { size: 32, viewBox: '0 0 32 32', body: tile },
  'tray-unread.png': {
    size: 32,
    viewBox: '0 0 32 32',
    body: `${tile}<circle cx="26" cy="6" r="6" fill="${RED}" stroke="#fff" stroke-width="2"/>`,
  },
  // macOS menu bar: black glyph on transparent, coloured by the system (template image).
  'trayTemplate.png': { size: 16, viewBox: '4.5 3.5 23 23', body: glyph('#000') },
  'trayTemplate@2x.png': { size: 32, viewBox: '4.5 3.5 23 23', body: glyph('#000') },
  'trayUnreadTemplate.png': { size: 16, viewBox: '4.5 3.5 23 23', body: unreadTemplate() },
  'trayUnreadTemplate@2x.png': { size: 32, viewBox: '4.5 3.5 23 23', body: unreadTemplate() },
  // Windows taskbar overlay for unread messages.
  'badge.png': { size: 16, viewBox: '0 0 16 16', body: `<circle cx="8" cy="8" r="7" fill="${RED}" stroke="#fff" stroke-width="1.5"/>` },
  'badge@2x.png': { size: 32, viewBox: '0 0 16 16', body: `<circle cx="8" cy="8" r="7" fill="${RED}" stroke="#fff" stroke-width="1.5"/>` },
};

function unreadTemplate() {
  // The dot is cut out of the bubble with a gap, so it stays visible in a one-colour image.
  return `<mask id="m"><rect x="0" y="0" width="32" height="32" fill="#fff"/><circle cx="24.5" cy="6" r="5" fill="#000"/></mask>
    <g mask="url(#m)">${glyph('#000')}</g><circle cx="24.5" cy="6" r="3.4" fill="#000"/>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, { size, viewBox, body }] of Object.entries(icons)) {
  await page.setViewportSize({ width: size, height: size });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`;
  await page.setContent(`<html><body style="margin:0;overflow:hidden">${svg}</body></html>`);
  writeFileSync(new URL(`../build/${name}`, import.meta.url), await page.locator('svg').screenshot({ omitBackground: true }));
  console.log(`wrote build/${name}`);
}
await browser.close();
