import { expect, openChannel, test, unique } from './helpers';

test('a channel post with subject gets a reply, both appear live for the other person', async ({ signIn }) => {
  const anna = await signIn('Anna Keller');
  const ben = await signIn('Ben Müller');
  await openChannel(anna, 'Produktentwicklung', 'Allgemein');
  await openChannel(ben, 'Produktentwicklung', 'Allgemein');

  const subject = unique('Sprint-Review');
  await anna.getByRole('button', { name: 'Neuer Beitrag' }).click();
  await anna.getByRole('textbox', { name: 'Betreff hinzufügen' }).fill(subject);
  await anna.getByRole('textbox', { name: /Starte eine neue Unterhaltung/ }).fill('Bitte bringt eure **Demos** mit.');
  await anna.getByRole('button', { name: 'Posten' }).click();

  const benPost = ben.locator('section', { has: ben.getByRole('heading', { name: subject }) });
  await expect(benPost).toBeVisible();
  await expect(benPost.locator('strong', { hasText: 'Demos' })).toBeVisible();

  await benPost.getByRole('button', { name: 'Antworten' }).last().click();
  const reply = benPost.getByRole('textbox', { name: 'Antworten' });
  await reply.fill('Bin dabei.');
  await reply.press('Enter');

  const annaPost = anna.locator('section', { has: anna.getByRole('heading', { name: subject }) });
  await expect(annaPost.getByRole('article', { name: /^Antwort von Ben Müller/ })).toContainText('Bin dabei.');
});
