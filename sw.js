/* R3: scoped cache, fresh navigations, offline fallback. Never touches progress. */
'use strict';
const PREFIX = 'uned-r3-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const CACHE = PREFIX + '20261021-1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const URLS = FILES.map(path => new URL(path,self.registration.scope).href);
const INDEX = new URL('./index.html',self.registration.scope).href;
self.addEventListener('install',event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE);
    await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    // Do not delete generic v1/v2 caches: another repository may own those names.
    await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope)) return;
  if (request.mode==='navigate') {
    event.respondWith((async()=>{
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request,{cache:'no-store'});
        if (response.ok) {
          if (url.pathname===new URL(INDEX).pathname||url.pathname===new URL(self.registration.scope).pathname) {
            try {await cache.put(INDEX,response.clone());} catch (_) {}
          }
          return response;
        }
        return (await cache.match(INDEX))||response;
      } catch (_) {
        return (await cache.match(INDEX))||new Response('Sin conexion. Abre la app con conexion una vez para prepararla.',{status:503,headers:{'Content-Type':'text/plain;charset=UTF-8'}});
      }
    })());
  } else if (URLS.includes(url.href)) {
    event.respondWith((async()=>{
      const cache = await caches.open(CACHE);
      return (await cache.match(request))||fetch(request);
    })());
  }
});
