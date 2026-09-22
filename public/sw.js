// Self-destructing service worker.
//
// The previous worker cached every successful response - the HTML shell
// and every hashed JS chunk - under one cache name that never changed,
// and served from that cache whenever a fetch failed. After a deploy that
// could hand a browser an old app shell next to a new chunk, which loads
// a second copy of React and crashes with React error #321 ("invalid hook
// call"). Seen live on 22 Sep 2026 for a returning user, every refresh.
//
// Browsers re-fetch sw.js on navigation; this version installs, removes
// every cache, unregisters itself, and reloads open tabs so they run
// without a worker. New visitors never register one (index.html no longer
// does). Offline support for an invoice-chasing app was never worth this.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })()
  )
})
