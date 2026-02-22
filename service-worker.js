// service-worker.js - Versione corretta
const CACHE_NAME = 'juvenilia-dashboard-v3.3'; // Incrementa versione
const DYNAMIC_CACHE = 'juvenilia-dynamic-v2';
const API_CACHE = 'juvenilia-api-v1';

// Assets da cacheare all'installazione
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
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

// Installazione - Cache assets statici
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installazione...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache assets statici...');
                // Filtra solo URL validi per il caching
                const validAssets = STATIC_ASSETS.filter(url => {
                    try {
                        new URL(url);
                        return true;
                    } catch {
                        return false;
                    }
                });
                return cache.addAll(validAssets);
            })
            .then(() => {
                console.log('✅ Service Worker installato con successo!');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Errore installazione Service Worker:', error);
            })
    );
});

// Attivazione - Pulizia cache vecchie
self.addEventListener('activate', (event) => {
    console.log('🔧 Service Worker: Attivazione...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('🗑️ Rimozione cache vecchia:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker attivato!');
                return self.clients.claim();
            })
    );
});

// Funzione per verificare se una richiesta è cacheabile
function isRequestCacheable(request) {
    // Verifica schema
    const url = new URL(request.url);
    
    // Non cacheare schemi non supportati
    if (url.protocol === 'chrome-extension:' || 
        url.protocol === 'moz-extension:' ||
        url.protocol === 'about:') {
        return false;
    }
    
    // Solo richieste GET sono cacheabili
    if (request.method !== 'GET') {
        return false;
    }
    
    return true;
}

// Strategia di cache: Network First per HTML, Cache First per assets
self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    // Ignora richieste non cacheabili
    if (!isRequestCacheable(request)) {
        return;
    }
    
    const url = new URL(request.url);
    
    // API Supabase - Strategia Network First con timeout
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache della risposta API
                    const responseClone = response.clone();
                    caches.open(API_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone);
                        })
                        .catch(err => console.log('Cache API fallita:', err));
                    return response;
                })
                .catch(() => {
                    // Fallback alla cache
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('📦 Risposta API dalla cache:', url.pathname);
                                return cachedResponse;
                            }
                            return new Response(JSON.stringify({
                                error: 'offline',
                                message: 'Sei offline. I dati potrebbero non essere aggiornati.'
                            }), {
                                headers: { 'Content-Type': 'application/json' }
                            });
                        });
                })
        );
        return;
    }
    
    // File HTML delle gare - Strategia Network First
    if (url.pathname.match(/gara\d+\.html$/)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache della risposta
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone);
                        })
                        .catch(err => console.log('Cache gara fallita:', err));
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('📦 Gara dalla cache:', url.pathname);
                                return cachedResponse;
                            }
                            // Fallback a pagina offline
                            return caches.match('/offline.html');
                        });
                })
        );
        return;
    }
    
    // Assets statici (CSS, JS, immagini) - Strategia Cache First
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image' ||
        request.destination === 'font') {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request)
                        .then(response => {
                            // Cache solo risposte valide
                            if (response && response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(DYNAMIC_CACHE)
                                    .then(cache => {
                                        cache.put(request, responseClone);
                                    })
                                    .catch(err => console.log('Cache asset fallita:', err));
                            }
                            return response;
                        });
                })
        );
        return;
    }
    
    // Default - Network First
    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache solo risposte GET valide
                if (request.method === 'GET' && response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone);
                        })
                        .catch(err => console.log('Cache default fallita:', err));
                }
                return response;
            })
            .catch(() => {
                return caches.match(request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            console.log('📦 Default cache hit:', url.pathname);
                            return cachedResponse;
                        }
                        // Fallback per pagine HTML
                        if (request.headers.get('Accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Gestione messaggi (per aggiornamenti)
self.addEventListener('message', (event) => {
    console.log('📨 Messaggio ricevuto:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'SYNC_ORDERS') {
        // Notifica tutti i client di sincronizzare
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_ORDERS',
                    timestamp: Date.now()
                });
            });
        });
    }
});

// Sincronizzazione background
self.addEventListener('sync', (event) => {
    console.log('🔄 Sync event:', event.tag);
    
    if (event.tag === 'sync-orders') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_ORDERS',
                        timestamp: Date.now()
                    });
                });
            })
        );
    }
});

// Push notification
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: '/icon-192.png',
        badge: '/favicon-32x32.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Juvenilia Dashboard', options)
    );
});

console.log('🔧 Service Worker caricato');
