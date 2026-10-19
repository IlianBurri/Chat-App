import { test as base, expect, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';

type SignIn = (name: string, options?: BrowserContextOptions) => Promise<Page>;

/**
 * `signIn(name)` opens a separate browser context per person and signs in with a demo account from the
 * login page; the contexts are closed after the test.
 */
export const test = base.extend<{ signIn: SignIn }>({
  signIn: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (name, options = {}) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByRole('button', { name: `Als ${name} anmelden` }).click();
      await page.waitForURL('**/chat');
      // The shell is ready once the title bar's search is there (it also registers Ctrl+K).
      await expect(page.getByRole('combobox', { name: 'Suche' })).toBeVisible();
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };

export async function openChat(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: /^Chat/ }).click();
  await page.getByRole('complementary', { name: 'Chat' }).getByRole('link', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

export async function openChannel(page: Page, group: string, channel: string) {
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: /^Gruppen/ }).click();
  const toggle = page.getByRole('button', { name: new RegExp(`^${group}`) });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await page.locator('li', { has: toggle }).getByRole('link', { name: new RegExp(`^${channel}`) }).click();
  await expect(page.getByRole('heading', { name: channel, level: 1 })).toBeVisible();
}

/** Text that no earlier run or test has used, so assertions cannot match old messages. */
export const unique = (text: string) => `${text} ${Date.now().toString(36)}`;
