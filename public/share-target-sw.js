/**
 * Handles the web-share-target POST. Static hosting can't accept a POST, so the service
 * worker intercepts it, parks the payload in the cache for the app to pick up, and bounces
 * to the workout screen. Pulled into the generated service worker via workbox importScripts.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && new URL(event.request.url).pathname.endsWith('/share-target')) {
    event.respondWith(receiveShare(event.request));
  }
});

async function receiveShare(request) {
  const form = await request.formData();
  const text = form.get('text');
  const image = form.get('image');

  const cache = await caches.open('shared-wod');
  if (typeof text === 'string' && text.trim()) {
    await cache.put('/shared-text', new Response(text));
  }
  if (image instanceof File && image.size > 0) {
    await cache.put('/shared-image', new Response(image));
  }

  return Response.redirect(`${self.registration.scope}#/workout`, 303);
}
