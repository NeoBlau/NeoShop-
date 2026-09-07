import { expect, test } from '@playwright/test';

/** Fresh email per run so the suite can be re-run without resetting the db. */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@e2e.local`;
}

const PASSWORD = 'parol-e2e-12345';

test('a supplier registers without help and lands in their own area', async ({ page }) => {
  const email = uniqueEmail('supplier');

  await page.goto('/register');
  await page.getByText('Я поставщик').click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByLabel('Название компании').fill('Тестовая Компания');

  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page).toHaveURL(/\/supplier$/);
  await expect(page.getByRole('heading', { name: 'Кабинет поставщика' })).toBeVisible();
  await expect(page.getByText('Тестовая Компания').first()).toBeVisible();
  // A brand new company is not approved yet and must be told so.
  await expect(page.getByText('Заявка на модерации')).toBeVisible();
});

test('a buyer cannot reach the supplier area', async ({ page }) => {
  const email = uniqueEmail('buyer');

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page).toHaveURL(/\/$/);

  await page.goto('/supplier');
  await expect(page).toHaveURL(/\/$/);
  // Home is the street; the counter in its corner is the cheapest proof that
  // the page decided it could show it rather than falling back to the
  // catalogue. It appears with the data, ahead of the geometry, so a guard
  // test does not end up waiting for a hundred megabytes of Paris.
  await expect(page.getByText(/Магазинов: \d+/)).toBeVisible({ timeout: 60_000 });
});

test('an anonymous visitor is sent to the login page and back again', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login\?next=%2Forders$/);

  await page.getByLabel('Email').fill('buyer@demo.3dsfera.local');
  await page.getByLabel('Пароль').fill('sfera-demo-2026');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole('heading', { name: 'Мои заказы' })).toBeVisible();
});

test('the interface switches to English and back', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();

  await page.getByRole('button', { name: 'en', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();

  await page.getByRole('button', { name: 'ru', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
});

test('wrong credentials produce a readable message, not a stack trace', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('buyer@demo.3dsfera.local');
  await page.getByLabel('Пароль').fill('definitely-wrong-1');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page.getByRole('alert')).toContainText('Неверный email или пароль');
});
