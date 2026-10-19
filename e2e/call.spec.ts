import type { Locator, Page } from '@playwright/test';
import { expect, openChat, test } from './helpers';

const callDialog = (page: Page) => page.getByRole('dialog', { name: /^Anruf:/ });
const tiles = (page: Page) => callDialog(page).getByTestId('call-tile');

/** The tile's video receives frames (the fake camera is an animation). */
async function playing(tile: Locator) {
  return tile.evaluate(async (el) => {
    const video = el.querySelector('video');
    if (!video || video.videoWidth === 0) return false;
    const before = video.currentTime;
    await new Promise((r) => setTimeout(r, 400));
    return video.currentTime > before;
  });
}

test('video call: lobby, ringing, accepting, video both ways, leaving', async ({ signIn }) => {
  const anna = await signIn('Anna Keller');
  const ben = await signIn('Ben Müller');
  await openChat(anna, 'Ben Müller');

  await anna.getByRole('button', { name: 'Videoanruf' }).click();
  const lobby = anna.getByRole('dialog', { name: 'Ben Müller beitreten' });
  await expect(lobby.getByRole('switch', { name: 'Kamera' })).toHaveAttribute('aria-checked', 'true');
  await lobby.getByRole('button', { name: 'Jetzt teilnehmen' }).click();
  await expect(callDialog(anna)).toBeVisible();

  const ringing = ben.getByRole('alertdialog', { name: 'Anna Keller ruft an' });
  await ringing.getByRole('button', { name: 'Mit Video annehmen' }).click();
  await expect(callDialog(ben)).toBeVisible();

  await expect(tiles(anna)).toHaveCount(2);
  await expect(tiles(ben)).toHaveCount(2);
  await expect.poll(() => playing(tiles(anna).filter({ hasText: 'Ben Müller' })), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => playing(tiles(ben).filter({ hasText: 'Anna Keller' })), { timeout: 15_000 }).toBe(true);

  await callDialog(ben).getByRole('button', { name: 'Verlassen' }).click();
  await expect(callDialog(ben)).toBeHidden();
  await expect(tiles(anna)).toHaveCount(1);
  await callDialog(anna).getByRole('button', { name: 'Verlassen' }).click();
  await expect(callDialog(anna)).toBeHidden();
});
