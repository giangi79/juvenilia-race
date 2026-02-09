// service-worker.js - VERSIONE CORRETTA
const CACHE_NAME = 'juvenilia-dashboard-v3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/logo.png',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css'
];

// INSTALL - Crea cache e precarica risorse
self.addEventListener('install', event => {
  console.log('✅ Service Worker installato');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache aperta:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Tutte le risorse precaricate');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Errore durante l\'installazione:', error);
      })
  );
});

// ACTIVATE - Pulisci vecchie cache
self.addEventListener('activate', event => {
  console.log('✅ Service Worker attivato');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Rimozione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache pulite, ora controllo i client');
      return self.clients.claim();
    })
  );
});

// FETCH - Strategia Cache First con fallback Network
self.addEventListener('fetch', event => {
  // Solo richieste GET e dello stesso origin (no CDN)
  if (event.request.method !== 'GET') return;
  
  // Per le pagine HTML, usa Network First
  if (event.request.url.includes('.html') || 
      event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clona la risposta per salvarla in cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Se offline, prova dalla cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Se non in cache, mostra pagina offline
              return caches.match('/offline.html');
            });
        })
    );
  } else {
    // Per altre risorse (CSS, JS, immagini), usa Cache First
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Se la risposta è valida, salva in cache
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
              
              return response;
            })
            .catch(() => {
              // Per le immagini, mostra un fallback
              if (event.request.destination === 'image') {
                return caches.match('/logo.png');
              }
            });
        })
    );
  }
});

// MESSAGE - Gestisci messaggi dalla pagina
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // SEMPRE ritorna una risposta immediata
  event.ports[0].postMessage({ status: 'OK', message: 'Message received' });
});

// SYNC - Background sync (opzionale)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-races') {
    event.waitUntil(syncRacesData());
  }
});

async function syncRacesData() {
  console.log('🔄 Sync dati in background');
  // Implementa la sincronizzazione dei dati qui
}
