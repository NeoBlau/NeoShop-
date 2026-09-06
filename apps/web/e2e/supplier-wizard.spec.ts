import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * The stage-2 acceptance criterion, walked end to end: a supplier uploads a
 * GLB, sets up an animation and sends the product for review without anyone
 * helping them.
 */

const ASSETS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../api/prisma/seed-assets',
);

test('a supplier takes a model from upload to moderation without help', async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto('/supplier/products/new');
  await page.getByLabel('Название товара').fill(`Робот-пылесос E2E ${Date.now()}`);
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await expect(page).toHaveURL(/\/supplier\/products\/[a-z0-9]+$/);

  // 1. Model: the browser inspects the file before anything is sent.
  await page.setInputFiles('input[type=file]', path.join(ASSETS, 'robot-vacuum.glb'));
  await expect(page.getByText('Файл проверен')).toBeVisible();
  await expect(page.getByText('анимаций')).toBeVisible();

  // 2. Processing: the server reports what it actually did.
  await page.getByRole('button', { name: 'Далее' }).click();
  // A 4K-textured model takes a minute or two to compress; that is the real
  // pipeline, not a stub, so the test waits for it rather than mocking it out.
  await expect(page.getByText(/Вес уменьшился на \d+%/)).toBeVisible({ timeout: 240_000 });
  await expect(page.getByText('Уровни детализации')).toBeVisible();

  // 3. Preview: the same viewer the buyer gets.
  await page.getByRole('button', { name: 'Далее' }).click();
  // The dev build adds the frame-rate panel's own canvases, so the scene is
  // addressed by the one three.js labels.
  await expect(page.locator('canvas[data-engine]').first()).toBeVisible();

  // 4. Animation: clips come from the uploaded model, captions from the supplier.
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Подставить по именам клипов' }).click();
  // Captions are filled in from the clip names the model actually carries.
  await expect(page.getByLabel('Подпись (ru)').first()).toHaveValue('Съехать с базы');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Сохранено')).toBeVisible();

  // 5. Card.
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Описание').fill('Лидарная навигация, влажная уборка, база самоочистки.');
  await page.getByLabel('Цена').fill('34990');
  await page.getByLabel('Остаток').fill('60');
  await page.getByLabel('Вес, г').fill('3800');
  await page.getByLabel('Длина, мм').fill('350');
  await page.getByLabel('Ширина, мм').fill('350');
  await page.getByLabel('Высота, мм').fill('98');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Сохранено')).toBeVisible();

  // 6. Moderation.
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Отправить на модерацию' }).click();
  await expect(page.getByText('Отправлено на модерацию')).toBeVisible();
});

test('a file that only pretends to be a model is refused in the browser', async ({ page }) => {
  await page.goto('/supplier/products/new');
  await page.getByLabel('Название товара').fill(`Подделка ${Date.now()}`);
  await page.getByRole('button', { name: 'Создать черновик' }).click();
  await expect(page).toHaveURL(/\/supplier\/products\/[a-z0-9]+$/);

  // A PNG renamed to .glb: the extension says model, the bytes say otherwise.
  await page.setInputFiles('input[type=file]', {
    name: 'chair.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
  });

  await expect(page.getByText('Это не GLB и не GLTF')).toBeVisible();
  await expect(page.getByText('Файл проверен')).toBeHidden();
});

test('a published product opens on its steps and the animation editor is reachable', async ({
  page,
}) => {
  await page.goto('/supplier/products');
  await page.getByText('Антенна спутниковая «Орбита 1.2»').first().click();
  await expect(page).toHaveURL(/\/supplier\/products\/[a-z0-9]+$/);

  // Every step of a finished product is navigable by name, which also pins
  // down the accessible name of the step buttons.
  await page.getByRole('button', { name: 'Оживление' }).click();
  await expect(page.getByLabel('Подпись (ru)').first()).toHaveValue('Развернуть антенну');

  await page.getByRole('button', { name: 'Карточка' }).click();
  await expect(page.getByLabel('Цена')).toHaveValue('18990');
});

test('the product list filters by status', async ({ page }) => {
  await page.goto('/supplier/products');

  await expect(page.getByRole('heading', { name: 'Мои товары' })).toBeVisible();
  await expect(page.getByText('Антенна спутниковая «Орбита 1.2»')).toBeVisible();

  await page.getByLabel('Статус').selectOption('REJECTED');
  await expect(page.getByText('Ничего не найдено. Попробуйте изменить фильтры.')).toBeVisible();
});

test('csv import reports the rows it could not take', async ({ page }) => {
  await page.goto('/supplier/import');

  const csv = [
    'title,description,category,price,currency,stock,weight_g,length_mm,width_mm,height_mm',
    '"Кронштейн E2E","Стальной кронштейн для антенн до 1.5 метра.",ELECTRONICS,2490,RUB,140,1800,420,180,180',
    '"Битая строка",коротко,ELECTRONICS,-5,RUB,10,100,10,10,10',
  ].join('\n');

  await page.setInputFiles('input[type=file]', {
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  await expect(page.getByText('Импорт завершён')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Создано: 1')).toBeVisible();
  await expect(page.getByText('Пропущено: 1')).toBeVisible();
});
