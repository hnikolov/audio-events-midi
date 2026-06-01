const CACHE_NAME = 'audio-midi-v1.3.15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const SHARE_TARGET_SUFFIX = '/share-target';
const SHARE_DB_NAME = 'audio-share-target-db';
const SHARE_DB_STORE = 'inbox';
const SHARE_DB_KEY = 'pending-share-files';

function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_DB_STORE)) {
        db.createObjectStore(SHARE_DB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open share target DB'));
  });
}

async function saveSharedFiles(files) {
  if (!files || files.length === 0) return;
  const db = await openShareDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_DB_STORE, 'readwrite');
    const store = tx.objectStore(SHARE_DB_STORE);
    store.put({ key: SHARE_DB_KEY, files, createdAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Failed to persist shared files'));
    tx.onabort = () => reject(tx.error || new Error('Share file transaction aborted'));
  });
  db.close();
}

function isShareTargetRequest(request) {
  if (!request || request.method !== 'POST') return false;
  const url = new URL(request.url);
  return url.pathname.endsWith(SHARE_TARGET_SUFFIX);
}

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = [];
    for (const entry of formData.values()) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }
    if (files.length > 0) {
      await saveSharedFiles(files);
    }
  } catch (err) {
    console.error('[share-target] failed to process share payload', err);
  }

  const redirectUrl = new URL('./index.html?share-target=1', self.registration.scope);
  return Response.redirect(redirectUrl.toString(), 303);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (isShareTargetRequest(e.request)) {
    e.respondWith(handleShareTarget(e.request));
    return;
  }

  if (e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
