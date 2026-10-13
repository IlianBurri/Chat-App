import { describe, expect, it } from 'vitest';
import { mentionsName, shouldAlert, type AlertContext } from './desktopNotify';

const base: AlertContext = {
  enabled: true,
  permission: 'granted',
  doNotDisturb: false,
  muted: false,
  mentioned: false,
  watching: false,
};

describe('shouldAlert', () => {
  it('alerts for new content somewhere else', () => {
    expect(shouldAlert(base)).toBe(true);
  });

  it('stays quiet when switched off, not permitted, in do-not-disturb or while watching', () => {
    expect(shouldAlert({ ...base, enabled: false })).toBe(false);
    expect(shouldAlert({ ...base, permission: 'default' })).toBe(false);
    expect(shouldAlert({ ...base, doNotDisturb: true, mentioned: true })).toBe(false);
    expect(shouldAlert({ ...base, watching: true })).toBe(false);
  });

  it('lets only mentions through muted chats and channels', () => {
    expect(shouldAlert({ ...base, muted: true })).toBe(false);
    expect(shouldAlert({ ...base, muted: true, mentioned: true })).toBe(true);
  });
});

describe('mentionsName', () => {
  it('finds the full name after @, ignoring case', () => {
    expect(mentionsName('Hallo @anna keller, kurz Zeit?', 'Anna Keller')).toBe(true);
  });

  it('does not match a longer word', () => {
    expect(mentionsName('@Anna Kellerei', 'Anna Keller')).toBe(false);
    expect(mentionsName('Anna Keller ohne At', 'Anna Keller')).toBe(false);
  });
});
