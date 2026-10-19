import { describe, expect, it } from 'vitest';
import { insecureOriginToAllow, normalizeServerUrl } from './net';

describe('normalizeServerUrl', () => {
  it('adds http:// and drops paths, so typed addresses work', () => {
    expect(normalizeServerUrl('192.168.1.20:4000')).toBe('http://192.168.1.20:4000');
    expect(normalizeServerUrl(' chat.firma.ch/login ')).toBe('http://chat.firma.ch');
    expect(normalizeServerUrl('https://chat.firma.ch/')).toBe('https://chat.firma.ch');
    expect(normalizeServerUrl('HTTP://Server:80')).toBe('http://server');
  });

  it('rejects empty input, other protocols and credentials in the URL', () => {
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl('   ')).toBeNull();
    expect(normalizeServerUrl('ftp://server')).toBeNull();
    expect(normalizeServerUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeServerUrl('http://user:pw@server')).toBeNull();
    expect(normalizeServerUrl('http://')).toBeNull();
  });
});

describe('insecureOriginToAllow', () => {
  it('marks a plain-http LAN server as secure so calls work', () => {
    expect(insecureOriginToAllow('http://192.168.1.20:4000')).toBe('http://192.168.1.20:4000');
    expect(insecureOriginToAllow('http://teamserver')).toBe('http://teamserver');
  });

  it('leaves https, loopback and no server alone', () => {
    expect(insecureOriginToAllow('https://chat.firma.ch')).toBeNull();
    expect(insecureOriginToAllow('http://localhost:4000')).toBeNull();
    expect(insecureOriginToAllow('http://127.0.0.1:4000')).toBeNull();
    expect(insecureOriginToAllow(null)).toBeNull();
  });
});
