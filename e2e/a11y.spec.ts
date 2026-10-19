import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openChannel, openChat, test } from './helpers';

/** WCAG 2.1 A/AA checks of the current view; returns the "serious" and "critical" findings. */
async function audit(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${where}: ${v.id} (${v.impact}) – ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n    ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`no serious accessibility problems in the main views (${scheme})`, async ({ browser, signIn }) => {
    const findings: string[] = [];
    const context = await browser.newContext({ colorScheme: scheme });
    const login = await context.newPage();
    await login.goto('/login');
    findings.push(...(await audit(login, 'login')));
    await context.close();

    const page = await signIn('Anna Keller', { colorScheme: scheme });
    await openChat(page, 'Ben Müller');
    findings.push(...(await audit(page, 'chat')));
    await openChannel(page, 'Produktentwicklung', 'Allgemein');
    findings.push(...(await audit(page, 'channel')));
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    for (const [section, ready] of [
      ['Aktivität', page.getByRole('complementary', { name: 'Aktivität' })],
      ['Kalender', page.getByTestId('calendar-range')],
      ['Anrufe', page.getByRole('heading', { name: 'Anruf tätigen' })],
      ['Dateien', page.getByRole('complementary', { name: 'Dateien' })],
    ] as const) {
      await nav.getByRole('link', { name: new RegExp(`^${section}`) }).click();
      await expect(ready).toBeVisible();
      findings.push(...(await audit(page, section)));
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });
}

test('theme follows the system and can be switched; the choice survives a reload', async ({ signIn }) => {
  const page = await signIn('Anna Keller', { colorScheme: 'dark' });
  const html = page.locator('html');
  await expect(html).toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Einstellungen und mehr' }).click();
  await page.getByRole('menuitemradio', { name: 'Hell' }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Chat' })).toBeVisible();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test('keyboard: Ctrl+K focuses the search, arrows move through results, Enter opens one', async ({ signIn }) => {
  const page = await signIn('Anna Keller');
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: /Suche/ });
  await expect(search).toBeFocused();
  await search.pressSequentially('Clara');
  await expect(page.getByRole('option', { name: /Clara Rossi/ }).first()).toBeVisible();
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'Clara Rossi', level: 1 })).toBeVisible();
});
