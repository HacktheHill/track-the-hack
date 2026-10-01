import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(fileURLToPath(new URL("../archive/out/", import.meta.url)));
const remoteOrigin = process.env.ARCHIVE_TEST_ORIGIN;
if (remoteOrigin && (new URL(remoteOrigin).origin !== remoteOrigin || !remoteOrigin.startsWith("https://")))
	throw new Error("ARCHIVE_TEST_ORIGIN must be an HTTPS origin without a trailing slash or path");
/** @type {Record<string, string>} */
const types = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".zip": "application/zip",
};
let oldWorker = false;
const server = createServer((req, res) => {
	void serve(req, res);
});
/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
async function serve(req, res) {
	try {
		const url = new URL(req.url ?? "/", "http://localhost");
		if (url.pathname === "/sw.js" && oldWorker) {
			res.setHeader("Content-Type", "text/javascript");
			res.end(
				'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));self.addEventListener("fetch",e=>{if(new URL(e.request.url).pathname==="/winners/")e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});',
			);
			return;
		}
		let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
		if (!file.startsWith(`${root}${path.sep}`) && file !== root) throw new Error("Invalid path");
		if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
		res.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
		res.setHeader("Cache-Control", "no-store");
		res.end(await readFile(file));
	} catch {
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/html");
		res.end(await readFile(path.join(root, "404.html")));
	}
}

if (!remoteOrigin) await new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(undefined)));
const address = server.address();
if (!remoteOrigin && (!address || typeof address === "string")) throw new Error("Static test server did not start");
const origin = remoteOrigin ?? `http://127.0.0.1:${typeof address === "object" ? (address?.port ?? 0) : 0}`;
const browser = await chromium.launch();
try {
	const context = await browser.newContext();
	const page = await context.newPage();
	/** @type {string[]} */
	const failures = [];
	/** @type {string[]} */
	const backend = [];
	page.on("pageerror", error => failures.push(error.message));
	page.on("response", response => {
		if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
	});
	await context.route("**/*", route => {
		const url = new URL(route.request().url());
		if (url.origin !== origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) {
			backend.push(url.pathname);
			return route.abort();
		}
		return route.continue();
	});
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 768, height: 1024 },
		{ width: 844, height: 390 },
		{ width: 390, height: 844 },
		{ width: 320, height: 720 },
	]) {
		await page.setViewportSize(viewport);
		for (const prefix of ["", "/fr"]) {
			for (const view of ["", "/winners", "/resources", "/metrics", "/sponsors/cgi"]) {
				const response = await page.goto(`${origin}${prefix}${view}/`, { waitUntil: "networkidle" });
				assert.equal(response?.status(), 200, `${prefix}${view}/ must be exported`);
				assert.ok(await page.locator("h1").isVisible());
				assert.equal(await page.locator("html").getAttribute("lang"), prefix ? "fr" : "en");
				assert.equal(
					await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
					false,
				);
				const nav = page.getByRole("navigation", {
					name: prefix ? "Navigation des archives" : "Archive navigation",
					exact: true,
				});
				const bottomNav = page.getByRole("navigation", {
					name: prefix ? "Navigation inférieure" : "Bottom navigation",
					exact: true,
				});
				const links = nav.locator("#archive-nav-links");
				const navBounds = await nav.boundingBox();
				assert.ok(navBounds, "The navbar must be visible");
				assert.ok(navBounds.height <= 80, "The navbar must remain a single compact row");
				if (view === "/sponsors/cgi") {
					const resourceLink = (viewport.width < 768 ? bottomNav : links).getByRole("link", {
						name: prefix ? "Ressources" : "Resources",
						exact: true,
					});
					assert.equal(
						await resourceLink.getAttribute("aria-current"),
						"page",
						"Sponsor details belong to Resources",
					);
				}
				if (viewport.width < 768) {
					assert.equal(await links.isVisible(), false, "Mobile top bar contains only logo and language");
					assert.equal(await bottomNav.isVisible(), true);
					assert.equal(await bottomNav.getByRole("link").count(), 4);
					const tapAreas = await bottomNav.getByRole("link").evaluateAll(elements =>
						elements.map(element => {
							const area = element.getBoundingClientRect();
							const icon = element.querySelector("span")?.getBoundingClientRect();
							return {
								width: area.width,
								height: area.height,
								iconWidth: icon?.width,
								iconHeight: icon?.height,
							};
						}),
					);
					assert.ok(
						tapAreas.every(area => area.width >= viewport.width / 4 - 4 && area.height >= 44),
						"Each link fills a quarter of the padded bottom bar",
					);
					assert.ok(
						tapAreas.every(area => area.iconWidth === 44 && area.iconHeight === 44),
						"Keep the original 44px visual highlight",
					);
					const bottomBounds = await bottomNav.boundingBox();
					assert.ok(bottomBounds);
					assert.equal(
						Math.round(bottomBounds.y + bottomBounds.height),
						viewport.height,
						"Navigation stays at the viewport bottom",
					);
					assert.ok(bottomBounds.height <= 65, "Icon-only navigation matches the compact app bar");
					assert.equal(
						await bottomNav.evaluate(element => element.scrollWidth > element.clientWidth),
						false,
						"No sideways scrolling, including French labels",
					);
					assert.equal(
						await bottomNav
							.locator("a")
							.evaluateAll(elements =>
								elements.some(element => element.scrollWidth > element.clientWidth),
							),
						false,
						"No clipped labels",
					);
					if (view !== "") {
						await page.locator("footer").scrollIntoViewIfNeeded();
						await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
						const footerBounds = await page.locator("footer").boundingBox();
						assert.ok(footerBounds);
						assert.ok(
							footerBounds.y + footerBounds.height <= bottomBounds.y,
							"The bottom bar must not cover the footer",
						);
					}
					await bottomNav
						.getByRole("link")
						.last()
						.click({ position: { x: 2, y: 22 } });
					await page.waitForURL(`${origin}${prefix}/metrics/`);
					await page.waitForFunction(
						() =>
							document.querySelector(".ui-bottom-nav a:last-child")?.getAttribute("aria-current") ===
							"page",
					);
					assert.equal(await bottomNav.getByRole("link").last().getAttribute("aria-current"), "page");
					assert.equal((await bottomNav.textContent())?.trim(), "", "Match the app's icon-only navigation");
					assert.equal(
						await bottomNav
							.getByRole("link", { name: prefix ? "Statistiques" : "Statistics", exact: true })
							.count(),
						1,
						"Icons retain translated accessible names",
					);
					await page.goto(`${origin}${prefix}${view}/`, { waitUntil: "networkidle" });
				} else {
					assert.equal(await bottomNav.isVisible(), false);
					assert.equal(await links.isVisible(), true, "Desktop links stay visible");
				}
				const brokenImages = await page.locator("img").evaluateAll(async images => {
					const elements = images.filter(image => image instanceof HTMLImageElement);
					await Promise.all(
						elements.map(async image => {
							image.loading = "eager";
							await image.decode().catch(() => undefined);
						}),
					);
					return elements.filter(image => image.naturalWidth === 0).map(image => image.src);
				});
				assert.deepEqual(brokenImages, [], `${prefix}${view}/ must have local, working images`);
				if (view === "") {
					assert.equal(
						await page.getByRole("heading", { name: "Hack the Hill III", level: 1, exact: true }).count(),
						1,
						"The illustrated wordmark keeps an accessible heading",
					);
					assert.equal(
						await page.locator('main img[src^="/assets/hero/"]').count(),
						5,
						"Reuse all five original SVG assets",
					);
					const scene = await page.locator('main img[src="/assets/hero/leaves.svg"]').evaluate(image => {
						const leaves = image.getBoundingClientRect();
						const tower = document
							.querySelector('main img[src="/assets/hero/building.svg"]')
							?.getBoundingClientRect();
						const hero = image.parentElement?.getBoundingClientRect();
						return {
							leavesWidth: leaves.width,
							towerHeight: tower?.height,
							heroHeight: hero?.height,
						};
					});
					assert.equal(scene.leavesWidth, viewport.width, "Leaves span the original full-width scene");
					assert.ok(
						typeof scene.towerHeight === "number" &&
							typeof scene.heroHeight === "number" &&
							scene.towerHeight >= scene.heroHeight * 0.85,
						"The tower retains the original immersive scale",
					);
					assert.equal(await page.locator("footer, [role=note]").count(), 0, "No extra homepage chrome");
					const winnerAction = page.locator('main [data-archive-action="winners"]');
					await winnerAction.click({ trial: true });
					await page.screenshot({
						path: `/tmp/track-archive-home-${viewport.width}-${prefix ? "fr" : "en"}.png`,
						fullPage: true,
					});
					for (const destination of ["winners"]) {
						const action = page.locator(`main [data-archive-action="${destination}"]`);
						assert.equal(await action.getAttribute("href"), `${prefix}/${destination}/`);
						await action.click();
						await page.waitForURL(`${origin}${prefix}/${destination}/`);
						await page.goto(`${origin}${prefix}/`, { waitUntil: "networkidle" });
					}
				}
				if (view === "/resources" && (await page.locator("details").count())) {
					await page.getByRole("button", { name: prefix ? "Tout développer" : "Expand all" }).click();
					assert.equal(await page.locator("details:not([open])").count(), 0);
				}
				if (view === "/winners") {
					assert.equal(
						await page
							.getByText(prefix ? "Résultats officiels" : "Official results", { exact: true })
							.count(),
						0,
					);
					assert.equal(
						await page.locator("h1").textContent(),
						prefix ? "Gagnants de Hack the Hill III" : "Hack the Hill III winners",
					);
					if (viewport.width < 640) {
						const heading = await page.locator("h1").boundingBox();
						const note = await page.getByRole("note").boundingBox();
						assert.ok(heading && note);
						assert.ok(
							heading.y - (note.y + note.height) <= 25,
							"The compact mobile introduction starts closer to the date strip",
						);
					}
				}
			}
		}
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${origin}/winners/`, { waitUntil: "networkidle" });
	await page.screenshot({ path: "/tmp/track-archive-navbar-mobile.png" });
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto(`${origin}/fr/winners/`, { waitUntil: "networkidle" });
	await page.screenshot({ path: "/tmp/track-archive-navbar-mobile-fr.png" });
	await page.goto(`${origin}/resources/`);
	await page.getByRole("link", { name: "FR", exact: true }).click();
	await page.waitForURL("**/fr/resources/");
	assert.equal(await page.locator("h1").textContent(), "Ressources pour Hack the Hill III");
	await page.getByRole("link", { name: "CGI", exact: true }).click();
	await page.waitForURL("**/fr/sponsors/cgi/");
	assert.ok((await page.locator("#archive-nav-links").textContent())?.includes("Gagnants"));
	const download = await context.request.get(`${origin}/assets/resources/cgi/Northwind_Challenge_Data.zip`);
	assert.equal(download.status(), 200);
	assert.ok((await download.body()).length > 100);
	assert.deepEqual(backend, [], "The archive must work with every external and backend request blocked");
	assert.deepEqual(failures, [], "No missing assets, broken routes, or hydration errors");
	await page.screenshot({ path: "/tmp/track-archive-mobile.png", fullPage: true });
	for (const route of ["/api/auth/session", "/internal/", "/profile/", "/pass/", "/judging/"]) {
		assert.equal((await context.request.get(`${origin}${route}`)).status(), 404);
	}
	if (remoteOrigin) {
		const document = await context.request.get(`${origin}/winners/`);
		assert.match(document.headers()["content-security-policy"] ?? "", /default-src 'self'/);
		assert.equal(document.headers()["x-content-type-options"], "nosniff");
		assert.equal(document.headers()["x-frame-options"], "DENY");
		const worker = await context.request.get(`${origin}/sw.js`);
		assert.equal(worker.status(), 200);
		assert.match(worker.headers()["cache-control"] ?? "", /no-store/);
		assert.match(await worker.text(), /unregister/);
	}
	await context.close();

	// Exercise replacing an existing live PWA worker, not just a fresh visit.
	// This needs a mutable local server; never substitute a worker on a real host.
	if (!remoteOrigin) {
		oldWorker = true;
		const legacyContext = await browser.newContext();
		const legacy = await legacyContext.newPage();
		await legacy.goto(`${origin}/`);
		await legacy.evaluate(async () => {
			await navigator.serviceWorker.register("/sw.js");
			await navigator.serviceWorker.ready;
			const cache = await caches.open("live-app-stale-pages");
			await cache.put(
				"/winners/",
				new Response("<h1>Stale live app</h1>", { headers: { "Content-Type": "text/html" } }),
			);
		});
		await legacy.goto(`${origin}/winners/`);
		assert.equal(await legacy.locator("h1").textContent(), "Stale live app");
		oldWorker = false;
		await legacy.evaluate(async () => {
			await (await navigator.serviceWorker.getRegistration())?.update();
		});
		await legacy.waitForFunction(
			async () =>
				(await caches.keys()).length === 0 && (await navigator.serviceWorker.getRegistrations()).length === 0,
		);
		await legacy.goto(`${origin}/winners/`, { waitUntil: "networkidle" });
		assert.equal(await legacy.locator("h1").textContent(), "Hack the Hill III winners");
		await legacy.setViewportSize({ width: 1440, height: 900 });
		await legacy.locator("img").evaluateAll(async images => {
			await Promise.all(
				images.map(async image => {
					if (image instanceof HTMLImageElement) {
						image.loading = "eager";
						await image.decode();
					}
				}),
			);
		});
		await legacy.screenshot({ path: "/tmp/track-archive-winners.png", fullPage: true });
		await legacyContext.close();
	}
	const files = await readdir(root, { recursive: true });
	assert.ok(!files.some(file => file.startsWith("api/") || file.includes("workbox-")));
	console.log(
		`Archive browser checks passed at ${origin}: EN/FR, desktop/mobile, sponsor navigation, downloads, backend isolation, private-route exclusion, ${remoteOrigin ? "host security headers and replacement worker" : "and live PWA cache retirement"}.`,
	);
} finally {
	await browser.close();
	if (!remoteOrigin) await new Promise(resolve => server.close(resolve));
}
