import { expect, test } from '@playwright/test';

/**
 * The showroom, and the promise that buying works without it.
 *
 * The 3D scene itself is verified by eye and by unit tests over its pure
 * parts — asserting on pixels rendered by a software rasteriser in CI proves
 * nothing about a real GPU. What is asserted here is everything around the
 * scene: that the world loads, that the fallback carries the same products,
 * and that a buyer can put one in the cart either way.
 */

test('the showroom loads with the seeded pavilions', async ({ page }) => {
  test.slow();
  await page.goto('/');

  await expect(page.getByText(/Павильонов: \d+/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Товаров: [1-9]/)).toBeVisible();
  await expect(page.locator('canvas[data-engine]').first()).toBeVisible();

  // The controls hint tells a first-time visitor what to do; its absence is
  // how a 3D scene turns into a black rectangle nobody interacts with.
  await expect(page.getByText(/WASD/)).toBeVisible();
});

test('quality can be pinned instead of left to the device', async ({ page }) => {
  await page.goto('/');
  const select = page.getByRole('combobox');
  await expect(select).toBeVisible({ timeout: 60_000 });

  await select.selectOption('low');
  await expect(select).toHaveValue('low');

  await select.selectOption('auto');
  await expect(select).toHaveValue('auto');
});

test('the flat catalog carries the same products and can sell them', async ({ page }) => {
  await page.goto('/catalog');

  await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
  await expect(page.getByText('Антенна спутниковая «Орбита 1.2»')).toBeVisible({
    timeout: 30_000,
  });

  // Every product in the catalogue is buyable, which is the entire point of
  // the fallback.
  const addButtons = page.getByRole('button', { name: 'В корзину' });
  await expect(addButtons.first()).toBeEnabled();
  await addButtons.first().click();

  const stored = await page.evaluate(() => localStorage.getItem('sfera.cart'));
  expect(stored).toContain('productId');
});

test('the showroom can be left for the catalog at any moment', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await expect(page.getByText(/Павильонов: \d+/)).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Открыть плоский каталог' }).click();
  await expect(page.getByText('Антенна спутниковая «Орбита 1.2»')).toBeVisible();
});
