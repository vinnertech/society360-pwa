// Service Worker version
const VERSION = '2.0.0';
const CACHE_NAME = `society360-v${VERSION}`;
const DYNAMIC_CACHE = `society360-dynamic-v${VERSION}`;
const API_CACHE = `society360-api-v${VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/action.html',
  '/offline.html',
  '/manifest.json',
  '/app.js',
  '/assets/css/pwa-styles.css',
  '/assets/js/pwa-install.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js'
];

// Routes to cache with different strategies
const ROUTES = {
  static: [
    /\.(css|js|json|ico|svg)$/,
    /\.(png|jpg|jpeg|gif|webp)$/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
    /cdn\.jsdelivr\.net/
  ],
  api: [
    /script\.google\.com/,
    /script\.googleusercontent\.com/
  ],
  html: [
    /\/$/,
    /\.html$/
  ]
};

// Install Event
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v' + VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Precaching failed:', error);
      })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v' + VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('society360-') && 
                     cacheName !== CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== API_CACHE;
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Claim clients immediately
      self.clients.claim(),
      
      // Perform database migrations if needed
      migrateIndexedDB()
    ])
  );
});

// Fetch Event with advanced strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests that aren't in our whitelist
  if (!shouldHandleRequest(url)) {
    return;
  }
  
  // Handle API requests
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle HTML navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
  
  // Handle static assets
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Default: Network first with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clonedResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request.clone());
    
    // Cache successful GET requests
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Return cached data and trigger background sync
      triggerBackgroundSync(request);
      return cachedResponse;
    }
    
    // If it's a POST request, store for later sync
    if (request.method === 'POST') {
      await storeOfflineRequest(request);
      return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Data saved offline. Will sync when online.'
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // No cached response available
    return new Response(JSON.stringify({
      error: 'You are offline and no cached data is available.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle navigation requests with offline fallback
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to get from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback page
    return caches.match('/offline.html');
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Return cached response immediately
    // Then update cache in background
    updateCacheInBackground(request);
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache for future
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed and not in cache
    return new Response('Resource not available offline', {
      status: 408,
      statusText: 'Offline'
    });
  }
}

// Background cache update
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse);
    }
  } catch (error) {
    console.log('[SW] Background update failed:', error);
  }
}

// Push Notification Event
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'Society 360',
    body: 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: data.vibrate,
    data: data.data,
    actions: [
      {
        action: 'open',
        title: 'View'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ],
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
  
  // Update badge count if supported
  if ('setAppBadge' in navigator) {
    incrementBadgeCount();
  }
});

// Notification Click Event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(windowClients => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
  
  // Clear badge count
  if ('clearAppBadge' in navigator) {
    clearAppBadge();
  }
});

// Background Sync Event
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-visitors') {
    event.waitUntil(syncOfflineVisitors());
  } else if (event.tag === 'sync-complaints') {
    event.waitUntil(syncOfflineComplaints());
  } else if (event.tag === 'sync-payments') {
    event.waitUntil(syncOfflinePayments());
  } else if (event.tag === 'sync-all') {
    event.waitUntil(syncAllOfflineData());
  }
});

// Periodic Background Sync
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'update-notices') {
    event.waitUntil(updateNotices());
  } else if (event.tag === 'update-maintenance') {
    event.waitUntil(updateMaintenanceData());
  }
});

// Message Event (Communication from page)
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

// Helper Functions
function shouldHandleRequest(url) {
  // Handle same-origin requests
  if (url.origin === self.location.origin) {
    return true;
  }
  
  // Handle whitelisted CDNs
  const whitelist = [
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'script.google.com',
    'script.googleusercontent.com'
  ];
  
  return whitelist.some(domain => url.hostname.includes(domain));
}

function isAPIRequest(url) {
  return url.href.includes('script.google.com') || 
         url.href.includes('/api/') ||
         url.pathname.startsWith('/action');
}

function isStaticAsset(url) {
  return ROUTES.static.some(pattern => pattern.test(url.href));
}

async function storeOfflineRequest(request) {
  const db = await openIndexedDB();
  const tx = db.transaction('offlineRequests', 'readwrite');
  const store = tx.objectStore('offlineRequests');
  
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.clone().text(),
    timestamp: Date.now()
  };
  
  await store.add(requestData);
  await tx.complete;
}

async function triggerBackgroundSync(request) {
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-all');
  }
}

async function syncAllOfflineData() {
  const db = await openIndexedDB();
  const tx = db.transaction('offlineRequests', 'readonly');
  const store = tx.objectStore('offlineRequests');
  const requests = await store.getAll();
  
  for (const reqData of requests) {
    try {
      const response = await fetch(reqData.url, {
        method: reqData.method,
        headers: reqData.headers,
        body: reqData.body
      });
      
      if (response.ok) {
        const deleteTx = db.transaction('offlineRequests', 'readwrite');
        await deleteTx.objectStore('offlineRequests').delete(reqData.id);
        await deleteTx.complete;
      }
    } catch (error) {
      console.error('[SW] Sync failed for:', reqData.url, error);
    }
  }
}

async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('Society360DB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offlineRequests')) {
        const store = db.createObjectStore('offlineRequests', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('cachedData')) {
        db.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}

async function migrateIndexedDB() {
  // Perform any needed database migrations
  console.log('[SW] Running IndexedDB migrations');
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('society360-'))
      .map(name => caches.delete(name))
  );
  console.log('[SW] All caches cleared');
}

async function incrementBadgeCount() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'INCREMENT_BADGE'
      });
    });
  } catch (error) {
    console.error('[SW] Badge increment failed:', error);
  }
}

async function clearAppBadge() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CLEAR_BADGE'
      });
    });
  } catch (error) {
    console.error('[SW] Badge clear failed:', error);
  }
}

async function syncOfflineVisitors() {
  console.log('[SW] Syncing offline visitors');
  // Implementation specific to visitor sync
}

async function syncOfflineComplaints() {
  console.log('[SW] Syncing offline complaints');
  // Implementation specific to complaint sync
}

async function syncOfflinePayments() {
  console.log('[SW] Syncing offline payments');
  // Implementation specific to payment sync
}

async function updateNotices() {
  console.log('[SW] Updating notices in background');
  // Fetch and cache latest notices
}

async function updateMaintenanceData() {
  console.log('[SW] Updating maintenance data');
  // Fetch and cache maintenance data
}