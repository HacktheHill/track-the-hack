/// <reference lib="webworker" />

// Custom service worker source, merged into the next-pwa generated sw.js via importScripts.
// See https://github.com/shadowwalker/next-pwa (customWorkerDir: "worker").

const serviceWorker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

serviceWorker.addEventListener("push", /** @param {PushEvent} event */ event => {
    if (!event.data) {
        return;
    }

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: "Notification", body: event.data.text() };
    }

    const { title = "Notification", body, tag, icon, data } = payload;

    event.waitUntil(
        serviceWorker.registration.showNotification(title, {
            body,
            tag,
            icon,
            data,
        }),
    );
});

serviceWorker.addEventListener("notificationclick", /** @param {NotificationEvent} event */ event => {
    event.notification.close();

    const targetUrl = new URL(event.notification.data?.url ?? "/", serviceWorker.location.origin).href;

    event.waitUntil(
        serviceWorker.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url === targetUrl && "focus" in client) {
                    return client.focus();
                }
            }
            if (serviceWorker.clients.openWindow) {
                return serviceWorker.clients.openWindow(targetUrl);
            }
        }),
    );
});
