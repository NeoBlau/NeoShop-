#!/usr/bin/env node
/**
 * Test runner.
 *
 *   node tests/run.js            run everything
 *   node tests/run.js io         run only files matching "io"
 *
 * Dependency free on purpose: the application has no dependencies either, so
 * the tests must run with a bare Node installation.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setFile, tests } from './harness.js';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2];

const files = readdirSync(here)
  .filter((name) => name.endsWith('.test.js'))
  .filter((name) => !filter || name.includes(filter))
  .sort();

for (const file of files) {
  setFile(file);
  await import(pathToFileURL(join(here, file)).href);
}

let passed = 0;
const failures = [];
let currentFile = '';
const start = Date.now();

for (const item of tests()) {
  if (item.file !== currentFile) {
    currentFile = item.file;
    process.stdout.write(`\n\x1b[1m${currentFile}\x1b[0m\n`);
  }
  try {
    await item.fn();
    passed++;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${item.name}\n`);
  } catch (error) {
    failures.push({ ...item, error });
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${item.name}\n      \x1b[31m${error.message}\x1b[0m\n`);
  }
}

const duration = Date.now() - start;
process.stdout.write(
  `\n${failures.length ? '\x1b[31m' : '\x1b[32m'}${passed} passed, ${failures.length} failed\x1b[0m  (${duration} ms, ${files.length} files)\n`
);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n\x1b[31m${failure.file} › ${failure.name}\x1b[0m\n${failure.error.stack}\n`);
  }
  process.exit(1);
}
