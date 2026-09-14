/** Zero-dependency test harness shared by every test file. */
const queue = [];
let currentFile = 'tests';

export function setFile(name) {
  currentFile = name;
}

export function test(name, fn) {
  queue.push({ name, fn, file: currentFile });
}

export function tests() {
  return queue;
}

function format(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const assert = {
  ok(value, message = 'expected a truthy value') {
    if (!value) throw new Error(`${message} (got ${format(value)})`);
  },
  equal(actual, expected, message = 'values differ') {
    if (actual !== expected) throw new Error(`${message}: expected ${format(expected)}, got ${format(actual)}`);
  },
  deepEqual(actual, expected, message = 'structures differ') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${message}:\n  expected ${b}\n  got      ${a}`);
  },
  includes(haystack, needle, message = 'value not found') {
    const found = typeof haystack === 'string' ? haystack.includes(needle) : Array.from(haystack).includes(needle);
    if (!found) throw new Error(`${message}: ${format(needle)} not found`);
  },
  throws(fn, message = 'expected an error') {
    let thrown = false;
    try {
      fn();
    } catch {
      thrown = true;
    }
    if (!thrown) throw new Error(message);
  },
  async rejects(promise, message = 'expected a rejection') {
    let thrown = false;
    try {
      await promise;
    } catch {
      thrown = true;
    }
    if (!thrown) throw new Error(message);
  },
  close(actual, expected, tolerance = 0.5, message = 'numbers differ') {
    if (Math.abs(actual - expected) > tolerance) throw new Error(`${message}: expected ~${expected}, got ${actual}`);
  },
};
