// Custom service worker source, merged into the next-pwa generated sw.js via importScripts.
// See https://github.com/shadowwalker/next-pwa (customWorkerDir: "worker").

self.addEventListener("push", event => {
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
        self.registration.showNotification(title, {
            body,
            tag,
            icon,
            data,
        }),
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    const targetUrl = event.notification.data?.url ?? "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url === targetUrl && "focus" in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        }),
    );
});
