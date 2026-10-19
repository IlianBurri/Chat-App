import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings, normalizeSettings, saveSettings } from './settings';

describe('normalizeSettings', () => {
  it('starts unconfigured with sensible defaults and a fresh secret', () => {
    const a = normalizeSettings(undefined);
    const b = normalizeSettings(undefined);
    expect(a).toMatchObject({ mode: null, port: 4000, lan: true, demo: false, closeToTray: true, autostart: false });
    expect(a.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(a.jwtSecret).not.toBe(b.jwtSecret);
  });

  it('keeps valid values and replaces invalid ones', () => {
    const s = normalizeSettings({
      mode: 'host',
      port: 80,
      lan: 'yes',
      jwtSecret: 'short',
      serverUrl: 42,
      window: { width: 200, height: 900, x: 10.4, maximized: true },
    });
    expect(s.mode).toBe('host');
    expect(s.port).toBe(4000);
    expect(s.lan).toBe(true);
    expect(s.jwtSecret).not.toBe('short');
    expect(s.serverUrl).toBe('');
    expect(s.window).toEqual({ x: 10, y: undefined, width: 800, height: 900, maximized: true });
  });

  it('ignores unknown modes', () => {
    expect(normalizeSettings({ mode: 'cloud' }).mode).toBeNull();
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips and survives a broken file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hallo-settings-'));
    const file = join(dir, 'nested', 'settings.json');
    const s = { ...normalizeSettings(undefined), mode: 'connect' as const, serverUrl: 'http://server:4000' };
    saveSettings(file, s);
    expect(loadSettings(file)).toEqual(s);
    expect(JSON.parse(readFileSync(file, 'utf8')).serverUrl).toBe('http://server:4000');

    writeFileSync(file, '{ not json');
    expect(loadSettings(file).mode).toBeNull();
  });
});
