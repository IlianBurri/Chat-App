import { expect, openChat, test, unique } from './helpers';

test('two people chat in real time: typing, message, reaction, read receipt', async ({ signIn }) => {
  const anna = await signIn('Anna Keller');
  const ben = await signIn('Ben Müller');
  await openChat(anna, 'Ben Müller');
  await openChat(ben, 'Anna Keller');

  const box = anna.getByRole('textbox', { name: 'Nachricht eingeben' });
  await box.pressSequentially('Hallo Ben', { delay: 30 });
  await expect(ben.getByText('Anna schreibt…')).toBeVisible();

  const text = unique('Hast du die Folien gesehen?');
  await box.fill(text);
  await box.press('Enter');
  const received = ben.getByRole('article', { name: /^Nachricht von Anna Keller/ }).filter({ hasText: text });
  await expect(received).toBeVisible();

  // Ben has the chat open, so Anna sees "read".
  await expect(anna.getByRole('img', { name: 'Gelesen' }).last()).toBeVisible();

  await received.hover();
  await received.getByRole('button', { name: 'Mit 👍 reagieren' }).click();
  await expect(anna.getByRole('button', { name: /👍 1 Reaktion von Ben Müller/ })).toBeVisible();
});
