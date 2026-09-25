import { expect, test } from '@playwright/test';

/**
 * The counter at the end of the street.
 *
 * Open to anyone, like the flat catalogue: someone who wants lunch should not
 * have to hold an account first. What is asserted is the whole path — pick a
 * menu, size it, add it, see the bill, order, and watch the tracking screen
 * come up with a courier on it.
 */

test('the menu opens with its categories and prices', async ({ page }) => {
  await page.goto('/food');

  await expect(page.getByRole('heading', { name: 'Neo Burger' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Полные меню' })).toBeVisible();

  // Every category has something in it, and the first one is priced.
  await expect(page.getByText('Меню Neo Double')).toBeVisible();
  await expect(page.getByText(/€/).first()).toBeVisible();
});

test('a size and an extra change what the tray charges', async ({ page }) => {
  await page.goto('/food');

  await page.getByRole('button', { name: 'Панини' }).click();
  await page
    .getByRole('button', { name: /Neo Classic/ })
    .first()
    .click();

  const sheet = page.getByRole('dialog', { name: 'Neo Classic' });
  await expect(sheet).toBeVisible();

  // 2,90 as it comes; the extra cheddar is 70 cents on top.
  await sheet.getByRole('button', { name: /Дополнительный чеддер/ }).click();
  await expect(sheet.getByRole('button', { name: /Добавить · .*3,60/ })).toBeVisible();

  await sheet.getByRole('button', { name: /Добавить/ }).click();
  await expect(page.getByText('На подносе: 1')).toBeVisible();
  await expect(page.getByText('Итого')).toBeVisible();
});

test('the tray carries the order to a courier on a map', async ({ page }) => {
  await page.goto('/food');

  await page.getByRole('button', { name: 'Полные меню' }).click();
  await page
    .getByRole('button', { name: /Меню Neo Double/ })
    .first()
    .click();

  const sheet = page.getByRole('dialog', { name: /Neo Double/ });
  await sheet.getByRole('button', { name: /Большая/ }).click();
  await sheet.getByRole('button', { name: /Добавить/ }).click();

  await page.getByRole('button', { name: 'Оформить доставку' }).click();

  const checkout = page.getByRole('dialog', { name: 'Оформить доставку' });
  await expect(checkout.getByRole('button', { name: 'Заказать' })).toBeDisabled();

  await checkout.getByPlaceholder('Улица, дом, квартира').fill('Rue de la Paix 14');
  await checkout.getByRole('button', { name: 'Заказать' }).click();

  // The tracking screen: an order number, a countdown and the five stages.
  await expect(page.getByText(/Заказ [A-Z]{4}-\d{2}/)).toBeVisible();
  await expect(page.getByText(/Осталось \d+ мин/)).toBeVisible();
  await expect(page.getByText('Готовится на кухне')).toBeVisible();
  await expect(page.getByText('Курьер в пути')).toBeVisible();
  await expect(page.getByText('Rue de la Paix 14')).toBeVisible();

  // The tray is empty once the order is placed, and the order survives a reload.
  await expect(page.getByText('Пока пусто. Выберите что-нибудь из меню.')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Заказ [A-Z]{4}-\d{2}/)).toBeVisible();
});

test('a menu says what it contains and what it saves', async ({ page }) => {
  await page.goto('/food');

  await page.getByRole('button', { name: 'Полные меню' }).click();
  await page
    .getByRole('button', { name: /Меню Криспи/ })
    .first()
    .click();

  const sheet = page.getByRole('dialog', { name: /Криспи/ });
  await expect(sheet.getByText('В меню входит')).toBeVisible();
  await expect(sheet.getByText(/дешевле на/)).toBeVisible();
});
