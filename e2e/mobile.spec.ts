import type { Page } from '@playwright/test';
import { expect, test } from './helpers';

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' };

async function expectNoSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('below 768px: one column with a tab bar, lists lead to details and back', async ({ signIn }) => {
  const page = await signIn('Anna Keller', phone);
  const tabs = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(tabs).toHaveCount(1);
  await expect(tabs.getByRole('link', { name: /^Chat/ })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Chat: list → conversation → back
  const chatList = page.getByRole('complementary', { name: 'Chat' });
  await chatList.getByRole('link', { name: /Ben Müller/ }).click();
  await expect(page.getByRole('textbox', { name: 'Nachricht eingeben' })).toBeVisible();
  await expect(chatList).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(chatList).toBeVisible();

  // Groups: list → channel → back
  await tabs.getByRole('link', { name: /^Gruppen/ }).click();
  const toggle = page.getByRole('button', { name: /^Produktentwicklung/ });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await page.locator('li', { has: toggle }).getByRole('link', { name: /^Allgemein/ }).click();
  await expect(page.getByRole('heading', { name: 'Allgemein', level: 1 })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(toggle).toBeVisible();

  // The other sections through the tabs and the "More" menu
  await tabs.getByRole('link', { name: /^Kalender/ }).click();
  await expect(page.getByTestId('calendar-range')).toContainText(/\d{4}/);
  await expectNoSidewaysScroll(page);
  for (const section of ['Anrufe', 'Dateien']) {
    await tabs.getByRole('button', { name: 'Weitere' }).click();
    await page.getByRole('menuitemradio', { name: section }).click();
    await expectNoSidewaysScroll(page);
  }
  await expect(page).toHaveURL(/\/files/);
});

test('desktop keeps the app bar and the list next to the conversation', async ({ signIn }) => {
  const page = await signIn('Anna Keller');
  await page.getByRole('complementary', { name: 'Chat' }).getByRole('link', { name: /Ben Müller/ }).click();
  await expect(page.getByRole('textbox', { name: 'Nachricht eingeben' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Chat' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).filter({ visible: true })).toHaveCount(1);
});
