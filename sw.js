// Service Worker for Data Security Learning Module v1.0.0
// Enterprise-level caching with error handling and chrome-extension filtering

const CACHE_NAME = 'data-security-module-v1.0.0';
const STATIC_CACHE_NAME = 'data-security-static-v1.0.0';

// Static assets to cache
const STATIC_FILES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/logo.svg',
    '/assets/favicon.svg',
    '/media/image1.png',
    '/media/image2.png',
    '/offline.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Dynamic cache for runtime assets
const DYNAMIC_CACHE_NAME = 'data-security-dynamic-v1.0.0';

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .catch((error) => {
                console.error('[SW] Error caching static files:', error);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Filter out chrome-extension URLs to prevent cache errors
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful navigation responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then((cache) => cache.put(request, responseClone))
                            .catch((error) => console.error('[SW] Error caching navigation:', error));
                    }
                    return response;
                })
                .catch(() => {
                    // Return offline fallback for navigation failures
                    return caches.match('/offline.html') || caches.match('/');
                })
        );
        return;
    }

    // Handle static assets with cache-first strategy
    if (STATIC_FILES.some(staticFile => request.url.includes(staticFile))) {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(request)
                        .then((response) => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            const responseClone = response.clone();
                            caches.open(STATIC_CACHE_NAME)
                                .then((cache) => cache.put(request, responseClone))
                                .catch((error) => console.error('[SW] Error caching static asset:', error));
                            return response;
                        })
                        .catch((error) => {
                            console.error('[SW] Error fetching static asset:', error);
                            return new Response('Asset not available', { status: 404 });
                        });
                })
        );
        return;
    }

    // Handle other requests with network-first strategy
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE_NAME)
                        .then((cache) => cache.put(request, responseClone))
                        .catch((error) => console.error('[SW] Error caching dynamic asset:', error));
                }
                return response;
            })
            .catch(() => {
                // Return cached version or offline fallback
                return caches.match(request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // For HTML requests, return offline page
                        if (request.headers.get('accept') &&
                            request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                        return new Response('Resource not available offline', { status: 404 });
                    });
            })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Handle background sync (if needed for future features)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    // Handle background sync events here if needed
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] Service Worker unhandled rejection:', event.reason);
});
