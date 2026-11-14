// Service Worker for Bicycle Tire Pressure Calculator
// Enables 100% offline functionality on mobile and desktop.
//
// Strategy: network-first. Online, every load gets the current files and
// refreshes the cache; offline (or on a very slow connection) the cached
// copy is served. The cache therefore never needs a manual version bump.

const CACHE_NAME = 'bike-pressure-v7';

// How long to wait for the network before falling back to the cache.
const NETWORK_TIMEOUT_MS = 3000;

const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/model.js',
    './js/chart.js',
    './js/app.js',
    './manifest.json',
    './icons/apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // 'reload' skips the browser's HTTP cache, which could hand back stale files.
            .then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

async function cachedResponse(request) {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(request);
    if (match) return match;
    // Offline navigation to any URL of the app falls back to the app shell.
    return request.mode === 'navigate' ? cache.match('./index.html') : undefined;
}

// Fetches from the network (revalidating with the server) and stores the result.
async function fetchAndCache(request) {
    const response = await fetch(request.url, { cache: 'no-cache' });
    if (response.ok && !new URL(request.url).search) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request.url, response.clone());
    }
    return response;
}

async function networkFirst(event) {
    const cached = await cachedResponse(event.request);
    const network = fetchAndCache(event.request);
    // Let a slow download finish in the background so the next load is current.
    event.waitUntil(network.catch(() => {}));

    if (!cached) return network;

    const fresh = network.then(response => (response.ok ? response : cached)).catch(() => cached);
    const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
    return Promise.race([fresh, timeout]);
}

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(networkFirst(event));
});
