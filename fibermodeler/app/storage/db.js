/**
 * IndexedDB storage: projects live in the browser so a session survives a
 * reload, a crash or a closed tab - exactly what a desktop app would do with
 * its working directory.
 */
const DB_NAME = 'fibermodeler';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_STATE = 'state';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    let result;
    try {
      result = fn(objectStore);
    } catch (err) {
      reject(err);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveProjectRecord(project) {
  const record = {
    id: project.id,
    name: project.name,
    updatedAt: new Date().toISOString(),
    project,
  };
  await tx(STORE_PROJECTS, 'readwrite', (store) => store.put(record));
  return record;
}

export async function loadProjectRecord(id) {
  return tx(STORE_PROJECTS, 'readonly', (store) => store.get(id));
}

export async function listProjectRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE_PROJECTS, 'readonly').objectStore(STORE_PROJECTS);
    const request = store.getAll();
    request.onsuccess = () =>
      resolve((request.result || []).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProjectRecord(id) {
  return tx(STORE_PROJECTS, 'readwrite', (store) => store.delete(id));
}

export async function setState(key, value) {
  return tx(STORE_STATE, 'readwrite', (store) => store.put({ key, value, updatedAt: Date.now() }));
}

export async function getState(key) {
  const record = await tx(STORE_STATE, 'readonly', (store) => store.get(key));
  return record?.value;
}

export function storageAvailable() {
  return typeof indexedDB !== 'undefined';
}
