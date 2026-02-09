// Nome della cache
const CACHE_NAME = 'juvenilia-dashboard-v1.0';
const OFFLINE_URL = '/offline.html';

// Risorse da cache
const urlsToCache = [
  './',
  './index.html',
  './logo.png',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'
];

// Installazione
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia cache-first con fallback a network
self.addEventListener('fetch', event => {
  // Non cache API calls e Supabase
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('/rest/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // Controlla se la risposta è valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Fallback offline per HTML
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Gestione sync in background (per dati offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-races') {
    console.log('Sync background attivato');
    // Qui puoi aggiungere logica per sync dati offline
  }
});

// Gestione push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nuova notifica dalla dashboard',
    icon: 'logo.png',
    badge: 'logo.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Apri',
        icon: 'logo.png'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: 'logo.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Dashboard Juvenilia', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Notifica chiusa
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
