/* EvoFit service worker: abre la app sin cobertura (el entreno se guarda en el móvil y se envía al volver la red). */
const SHELL_CACHE = 'evofit-shell-v1'
const ASSET_CACHE = 'evofit-assets-v1'
const SHELL = ['/', '/index.html', '/site.webmanifest', '/icon-192.png', '/apple-touch-icon.png', '/favicon-32.png', '/logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Datos y sesión siempre de la red: nunca se sirven respuestas de API cacheadas.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/sanctum') || url.pathname.startsWith('/storage')) return

  if (request.mode === 'navigate') {
    // Red primero (para tener siempre la última versión); sin red, la app guardada.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    // Archivos con hash en el nombre: no cambian nunca.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
