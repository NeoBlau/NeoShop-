import { expect, test } from '@playwright/test';
import { SUPPLIER_STATE } from './auth-state.js';

/**
 * A purchase, end to end: catalogue → cart → address → payment → status →
 * the supplier shipping it → the tracking number reaching the buyer.
 *
 * The payment goes through the built-in mock provider, which signs its own
 * callback and hands it to the same handler a Stripe webhook reaches, so this
 * spec exercises the real state machine rather than a shortcut around it.
 *
 * The product is named rather than picked by position: the supplier half of
 * the test signs in as the company that owns the antenna, and "the first card
 * in the grid" is not a promise the catalogue makes.
 */
const PRODUCT = 'Антенна спутниковая «Орбита 1.2»';
const TRACKING = 'E2E0000000001';

test.describe.configure({ mode: 'serial' });

let orderNumber = '';

test('a buyer walks from the catalogue to a paid order', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();

  const card = page.locator('li').filter({ hasText: PRODUCT }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole('button', { name: 'В корзину' }).click();

  // The header badge is the only feedback that the click landed.
  await expect(page.getByRole('link', { name: /Корзина\s*1/ })).toBeVisible();

  await page.getByRole('link', { name: /Корзина/ }).click();
  await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible();

  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('heading', { name: 'Оформление заказа' })).toBeVisible();

  await page.getByLabel('Получатель').fill('Иван Петров');
  await page.getByLabel('Телефон').fill('+7 900 000-00-00');
  await page.getByLabel('Город').fill('Москва');
  await page.getByLabel('Индекс').fill('101000');
  await page.getByLabel('Адрес', { exact: true }).fill('Тверская улица, 1');

  // The shipping quote arrives on its own, keyed to the destination country.
  await expect(page.getByText(/Срок: \d+–\d+ рабочих дней/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  await expect(page.getByRole('heading', { name: 'Заказ оформлен' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Оплатить тестовой картой' }).click();

  await page.waitForURL(/\/orders\/SF-/);
  orderNumber = new URL(page.url()).pathname.split('/').pop() ?? '';
  expect(orderNumber).toMatch(/^SF-\d{6}-[A-Z0-9]{5}$/);

  await expect(page.getByText('Состав заказа')).toBeVisible();
  await expect(page.getByText('Иван Петров')).toBeVisible();
  await expect(page.getByText('Трек-номер появится после отгрузки')).toBeVisible();

  // The cart became an order; a reload must not resurrect it.
  await page.goto('/cart');
  await expect(page.getByText('В корзине пусто')).toBeVisible();
});

test('the order appears in the buyer list', async ({ page }) => {
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Мои заказы' })).toBeVisible();
  await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 20_000 });
});

test('the supplier ships it and the tracking number reaches the buyer', async ({
  browser,
  page,
}) => {
  const supplier = await browser.newContext({ storageState: SUPPLIER_STATE });
  const supplierPage = await supplier.newPage();

  try {
    await supplierPage.goto('/supplier/orders');
    await expect(supplierPage.getByRole('heading', { name: 'Входящие заказы' })).toBeVisible();

    const card = supplierPage.locator('section').filter({ hasText: orderNumber }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.getByLabel('Перевозчик').fill('СДЭК');
    await card.getByLabel('Трек-номер').fill(TRACKING);
    await card.getByLabel('Статус заказа').selectOption('IN_TRANSIT');
    await card.getByRole('button', { name: 'Обновить отгрузку' }).click();

    await expect(card.getByText('Сохранено')).toBeVisible({ timeout: 15_000 });
  } finally {
    await supplier.close();
  }

  await page.goto(`/orders/${orderNumber}`);
  await expect(page.getByText(TRACKING)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('В пути')).toBeVisible();
});
