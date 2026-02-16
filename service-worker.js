const CACHE_NAME = 'juvenilia-dashboard-v3.2';
const DYNAMIC_CACHE = 'juvenilia-dynamic-v1';

// Asset da cacheare all'installazione
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-152.png',
  '/icon-192.png',
  '/icon-384.png',
  '/icon-512.png',
  '/logo.png',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png'
];

// CDN e risorse esterne
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'
];

// Installazione - cache statica
self.addEventListener('install', event => {
  console.log('📦 Service Worker: Installazione');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache aperta');
        return cache.addAll([...STATIC_ASSETS, ...CDN_ASSETS]);
      })
      .then(() => {
        console.log('✅ Service Worker installato con cache statica');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Errore durante il caching:', error);
      })
  );
});

// Attivazione - pulizia cache vecchie
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Attivazione');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('🗑️ Rimozione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker attivato, cache pulita');
      return self.clients.claim();
    })
  );
});

// Strategia di cache: Stale-While-Revalidate per le richieste API
// Network First per le pagine HTML, Cache First per gli asset statici
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API calls - Stale While Revalidate
  if (url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return fetch(event.request)
          .then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => {
            return caches.match(event.request);
          });
      })
    );
    return;
  }
  
  // Pagine HTML - Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache della risposta
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback alla pagina offline
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }
  
  // Asset statici - Cache First
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' || 
      event.request.destination === 'font' ||
      event.request.destination === 'image') {
    
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // Aggiorna in background
          fetch(event.request).then(networkResponse => {
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(event.request, networkResponse);
            });
          }).catch(() => {});
          
          return cachedResponse;
        }
        
        return fetch(event.request).then(networkResponse => {
          return caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }
  
  // Default - Network with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Non cacheare risposte non valide
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(event.request, responseClone);
        });
        
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Gestione notifiche push (opzionale)
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Nuovo aggiornamento disponibile',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Juvenilia Dashboard', options)
  );
});

// Gestione click su notifica
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Sincronizzazione in background
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ORDERS',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Errore sincronizzazione:', error);
  }
}

// Gestione messaggi dal client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🔧 Service Worker caricato');
