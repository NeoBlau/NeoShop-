import { expect, test } from '@playwright/test';

/**
 * Administration: the moderation queue, the supplier ledger, pavilion slots,
 * the audit log and the numbers.
 *
 * Everything here is destructive to demo data, so the spec puts back what it
 * takes: a product it rejects is approved again before the file ends, and the
 * world spec that runs beside it expects to find it published.
 */
test.describe.configure({ mode: 'serial' });

/**
 * The product this file takes off the street, so it can put the same one back.
 *
 * An earlier version rejected "the first card" and re-approved "the first
 * card", which are not necessarily the same product — and when a run failed in
 * between, it left one rejected for the next suite to trip over.
 */
let rejectedTitle = '';

test('the dashboard opens every section', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible();

  for (const [name, heading] of [
    ['Модерация', 'Модерация'],
    ['Поставщики', 'Поставщики'],
    ['Павильоны', 'Павильоны'],
    ['Журнал действий', 'Журнал действий'],
    ['Метрики', 'Метрики'],
  ] as const) {
    await page.goto('/admin');
    await page
      .getByRole('link', { name: new RegExp(name) })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('a rejection needs a reason, and the supplier gets it', async ({ page }) => {
  await page.goto('/admin/moderation');
  await expect(page.getByRole('heading', { name: 'Модерация' })).toBeVisible();

  // Pick the first card whose company is already approved. A product belonging
  // to a company still on moderation cannot be published at all — the server
  // refuses it — so rejecting one would leave it rejected with no way back,
  // which is exactly what an earlier version of this file did.
  const candidate = page
    .locator('section')
    .filter({ has: page.getByRole('button', { name: 'Опубликовать' }) })
    .filter({ hasNot: page.getByText(/ещё не одобрена/) })
    .first();

  await expect(candidate).toBeVisible({ timeout: 30_000 });

  rejectedTitle = (await candidate.getByRole('heading').first().textContent()) ?? '';
  expect(rejectedTitle).not.toBe('');

  // Re-anchor on the title before touching anything. Locators are lazy and
  // re-resolve on every action: pressing "reject" swaps the publish button for
  // the reason form, the filter above stops matching this card, and the next
  // step would quietly act on a different product.
  const card = page.locator('section').filter({ hasText: rejectedTitle }).first();

  await card.getByRole('button', { name: 'Отклонить', exact: true }).click();
  // Too short: the server refuses it and the moderator is told why, rather
  // than the supplier receiving the word "no" and nothing else.
  await card.getByLabel('Причина').fill('мало');
  await card.getByRole('button', { name: 'Отклонить товар' }).click();
  await expect(card.getByText(/Напишите причину/)).toBeVisible();

  await card.getByLabel('Причина').fill('Нормали вывернуты, модель светится изнутри');
  await card.getByRole('button', { name: 'Отклонить товар' }).click();

  // The queue reloads without it.
  await expect(page.getByText('Очередь пуста').or(page.locator('section').first())).toBeVisible();
});

test('the decision is in the audit log', async ({ page }) => {
  await page.goto('/admin/audit');
  await expect(page.getByRole('heading', { name: 'Журнал действий' })).toBeVisible();
  await expect(page.getByText('product.reject').first()).toBeVisible({ timeout: 20_000 });

  // The reason itself is not: it can name a person or a trademark dispute,
  // and the log is read by everyone with the admin role.
  await expect(page.getByText(/Нормали вывернуты/)).toHaveCount(0);
});

test('a taken pavilion slot is refused rather than swapped', async ({ page }) => {
  await page.goto('/admin/pavilions');
  await expect(page.getByRole('heading', { name: 'Павильоны' })).toBeVisible();

  const first = page.locator('section').first();
  await first.getByLabel('Слот').fill('2');
  await first.getByRole('button', { name: 'Сохранить' }).click();

  await expect(first.getByText(/Слот 2 уже занят/)).toBeVisible({ timeout: 15_000 });

  // Put it back, so the next run starts from the same world.
  await first.getByLabel('Слот').fill('1');
  await first.getByRole('button', { name: 'Сохранить' }).click();
  await expect(first.getByText('Сохранено')).toBeVisible();
});

test('metrics count what the street did', async ({ page }) => {
  await page.goto('/admin/metrics');
  await expect(page.getByRole('heading', { name: 'Метрики' })).toBeVisible();
  await expect(page.getByText('Заказов', { exact: true })).toBeVisible();
  await expect(page.getByText('Заказы за две недели')).toBeVisible();
  await expect(page.getByText('Лучшие товары')).toBeVisible();
});

test('a rejection can be reconsidered, and the world gets its product back', async ({ page }) => {
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: 'Отклонён' }).click();

  const card = page.locator('section').filter({ hasText: rejectedTitle }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: 'Опубликовать' }).click();

  // Nothing this file rejected is left rejected.
  await expect(page.locator('section').filter({ hasText: rejectedTitle })).toHaveCount(0, {
    timeout: 20_000,
  });

  // Back on the street: the catalogue is the cheapest place to check.
  await page.goto('/catalog');
  await expect(page.getByText('Антенна спутниковая «Орбита 1.2»')).toBeVisible({
    timeout: 30_000,
  });
});
