import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as setup } from '@playwright/test';

/**
 * Signs in once and saves the session for the supplier specs.
 *
 * The API allows ten credential requests per five minutes per address, which
 * is the right limit for a login endpoint and the wrong thing for a test suite
 * to spend on repeated sign-ins. One login, reused.
 */
export const SUPPLIER_STATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.auth/supplier.json',
);

setup('sign in as a supplier', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('antenna@demo.3dsfera.local');
  await page.getByLabel('Пароль').fill('sfera-demo-2026');
  await page.getByRole('button', { name: 'Войти' }).click();

  await page.waitForURL('**/supplier');
  await expect(page.getByRole('heading', { name: 'Кабинет поставщика' })).toBeVisible();

  await page.context().storageState({ path: SUPPLIER_STATE });
});
