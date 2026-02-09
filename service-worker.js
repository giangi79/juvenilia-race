// service-worker.js - VERSIONE 3.1 CORRETTA
const CACHE_NAME = 'juvenilia-dashboard-v3.1';
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  'offline.html',
  'logo.png',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'icon-144.png',
  'icon-192.png',
  'icon-512.png'
];

// INSTALL - Crea cache e precarica risorse CON GESTIONE ERRORI
self.addEventListener('install', event => {
  console.log('✅ Service Worker installato - v3.1');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache aperta:', CACHE_NAME);
        
        // Aggiungi le risorse una alla volta con gestione errori
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`⚠️  Impossibile caricare in cache: ${url}`, error);
              // Non interrompere l'installazione per errori di cache
              return Promise.resolve();
            });
          })
        );
      })
      .then(() => {
        console.log('✅ Installazione completata');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Errore durante l\'installazione:', error);
        // Non fallire l'installazione, continua comunque
        return self.skipWaiting();
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
      console.log('✅ Cache pulite');
      return self.clients.claim();
    })
  );
});

// FETCH - Strategia Cache First con fallback Network
self.addEventListener('fetch', event => {
  // Solo richieste GET
  if (event.request.method !== 'GET') return;
  
  const requestUrl = new URL(event.request.url);
  
  // Salta le richieste a CDN esterni (le gestiamo in cache solo se caricate)
  if (requestUrl.origin !== self.location.origin) {
    // Per CDN, usa solo network
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Se trovato in cache, restituisci
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Altrimenti fai fetch
        return fetch(event.request)
          .then(response => {
            // Se la risposta è valida, salvala in cache
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(error => {
            console.log('🌐 Offline - fallback per:', event.request.url);
            
            // Per le pagine HTML, mostra offline.html
            if (event.request.destination === 'document' || 
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('offline.html');
            }
            
            // Per le immagini, prova con il logo
            if (event.request.destination === 'image') {
              return caches.match('logo.png');
            }
            
            // Altrimenti ritorna null
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// MESSAGE - Gestisci messaggi dalla pagina
self.addEventListener('message', event => {
  console.log('📨 Messaggio ricevuto dal client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏩ Saltando fase di attesa...');
    self.skipWaiting();
  }
  
  // Rispondi immediatamente
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ 
      status: 'OK', 
      message: 'Service Worker attivo',
      version: '3.1'
    });
  }
});
