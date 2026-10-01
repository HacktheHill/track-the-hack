/* Retire the live PWA's caches when the archive replaces the app on this origin.
 * Do not copy its worker or precache manifest into the archive. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
	event.waitUntil((async () => {
		await Promise.all((await caches.keys()).map(name => caches.delete(name)));
		await self.clients.claim();
		await self.registration.unregister();
	})());
});
