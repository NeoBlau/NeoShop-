import { defineConfig } from 'vitest/config';

/**
 * Unit tests here exercise pure logic and the model pipeline; none of them talk
 * to Postgres or S3. The variables below only satisfy the configuration check
 * that runs when `src/env.ts` is imported, so a developer without a running
 * database can still run the suite.
 */
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://sfera:sfera@localhost:5432/sfera?schema=public',
      SESSION_SECRET: process.env['SESSION_SECRET'] ?? 'unit-test-secret-not-used-anywhere-real',
    },
  },
});
