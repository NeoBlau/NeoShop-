import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE } from './auth-state.js';

/** Signs in once as the demo administrator. Same reasoning as the others. */
setup('sign in as an admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@demo.3dsfera.local');
  await page.getByLabel('Пароль').fill('sfera-demo-2026');
  await page.getByRole('button', { name: 'Войти' }).click();

  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STATE });
});
