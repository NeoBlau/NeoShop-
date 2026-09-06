import Papa from 'papaparse';
import {
  AppError,
  CSV_COLUMNS,
  csvProductRowSchema,
  type CsvImportResult,
  type CsvImportRowResult,
} from '@3dsfera/shared';
import type { Db } from '../../lib/prisma.js';
import { createDraft, updateProduct } from './service.js';

const MAX_ROWS = 500;

/**
 * Bulk import from a spreadsheet export.
 *
 * Rows are independent: a bad line is reported and skipped, the rest are
 * imported. An import that fails wholesale because of one typo in row 47 is
 * worse than useless when the file has 300 rows.
 *
 * Imported products land as drafts without a model, because a CSV cannot carry
 * geometry. The supplier attaches models afterwards, one product at a time.
 */
export async function importProductsCsv(
  db: Db,
  supplierId: string,
  text: string,
): Promise<CsvImportResult> {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];
  const missingColumns = CSV_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: `CSV is missing columns: ${missingColumns.join(', ')}`,
      issues: missingColumns.map((column) => ({
        path: column,
        code: 'missing_column',
        message: column,
      })),
    });
  }

  if (parsed.data.length > MAX_ROWS) {
    throw new AppError({
      status: 400,
      code: 'ERR_VALIDATION',
      message: `CSV has ${parsed.data.length} rows, the limit is ${MAX_ROWS}`,
      params: { max: MAX_ROWS },
    });
  }

  const rows: CsvImportRowResult[] = [];
  let created = 0;

  for (const [index, raw] of parsed.data.entries()) {
    // +2: one for the header line, one because humans count from 1.
    const line = index + 2;
    const result = csvProductRowSchema.safeParse(raw);

    if (!result.success) {
      const issue = result.error.issues[0];
      rows.push({
        line,
        title: raw['title'] ?? '',
        status: 'skipped',
        issue: issue?.code === 'custom' ? issue.message : (issue?.code ?? 'invalid_row'),
        ...(issue?.path.length ? { field: issue.path.map(String).join('.') } : {}),
      });
      continue;
    }

    const row = result.data;
    const draft = await createDraft(db, supplierId, { title: row.title });

    await updateProduct(db, supplierId, draft.id, {
      description: row.description,
      category: row.category,
      // Major units in the file, minor units in the database. Rounding here is
      // the only place a fractional price is allowed to exist.
      priceCents: Math.round(row.price * 100),
      currency: row.currency,
      stock: row.stock,
      weightGrams: row.weight_g,
      lengthMm: row.length_mm,
      widthMm: row.width_mm,
      heightMm: row.height_mm,
    });

    rows.push({ line, title: row.title, status: 'created' });
    created += 1;
  }

  return { created, skipped: rows.length - created, rows };
}

/** The template the cabinet offers for download. */
export function csvTemplate(): string {
  const example = [
    'Антенна спутниковая Орбита 1.2',
    'Офсетная антенна 120 см с автонаведением. Крепление на стену или мачту.',
    'ELECTRONICS',
    '18990',
    'RUB',
    '25',
    '9400',
    '1250',
    '700',
    '340',
  ];

  return `${CSV_COLUMNS.join(',')}\n${example.map((value) => `"${value}"`).join(',')}\n`;
}
