import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the setup projects park their signed-in sessions.
 *
 * This file is not a spec — Playwright's default `testMatch` only collects
 * `*.spec.ts`, and the setup projects name their files explicitly — so specs
 * may import it without tripping the "a test file must not import a test
 * file" rule.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

export const SUPPLIER_STATE = path.resolve(here, '../.auth/supplier.json');
export const BUYER_STATE = path.resolve(here, '../.auth/buyer.json');
export const ADMIN_STATE = path.resolve(here, '../.auth/admin.json');
