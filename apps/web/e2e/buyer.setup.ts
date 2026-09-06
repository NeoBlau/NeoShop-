import { expect, test as setup } from '@playwright/test';
import { BUYER_STATE } from './auth-state.js';

/**
 * Signs in once as the demo buyer, for the specs that need an account.
 * Same reasoning as the supplier setup: the credential endpoint is rate
 * limited on purpose, and a suite should not spend that limit on sign-ins.
 */
setup('sign in as a buyer', async ({ page }) => {
  // Landing on the catalogue rather than the showroom: this setup needs a
  // cookie, not a compiled shader.
  await page.goto('/login?next=%2Fcatalog');
  await page.getByLabel('Email').fill('buyer@demo.3dsfera.local');
  await page.getByLabel('Пароль').fill('sfera-demo-2026');
  await page.getByRole('button', { name: 'Войти' }).click();

  await page.waitForURL('**/catalog');
  await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
  await page.context().storageState({ path: BUYER_STATE });
});
