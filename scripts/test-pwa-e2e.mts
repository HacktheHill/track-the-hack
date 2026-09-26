import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { EventType, PrismaClient, ScannerWorkflow } from "@prisma/client";
import { chromium, type Browser, type Page } from "playwright-core";
import { z } from "zod";
import { publicPrecacheUrls } from "@root/pwa-runtime-caching";

const participantSchema = z
	.object({
		id: z.string().min(1),
		tShirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL", "NONE"]),
		mealCategory: z.enum(["STANDARD", "VEGETARIAN", "VEGAN", "HALAL", "OTHER"]),
		acceptanceExpiry: z.string().datetime(),
		walkIn: z.boolean(),
	})
	.strict();
const processedResponseSchema = z.object({ processed: z.number().int().nonnegative() }).strict();
const claimResponseSchema = z.object({ claimUrl: z.string().url(), expiresAt: z.string().datetime() }).strict();

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

const getOpenPort = () =>
	new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("Could not reserve a local port"));
				return;
			}
			server.close(error => (error ? reject(error) : resolve(address.port)));
		});
	});

const findChromium = async () => {
	const candidates = [
		process.env.CHROMIUM_PATH,
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	].filter((candidate): candidate is string => candidate !== undefined);

	for (const candidate of candidates) {
		try {
			await access(candidate, fsConstants.X_OK);
			return candidate;
		} catch {
			// Try the next common browser location.
		}
	}
	throw new Error("Chromium not found. Install Chromium or set CHROMIUM_PATH to its executable.");
};

const port = await getOpenPort();
const baseUrl = `http://127.0.0.1:${port}`;
const serverOutput: string[] = [];
const rememberOutput = (chunk: Buffer | string) => {
	serverOutput.push(String(chunk));
	if (serverOutput.length > 200) serverOutput.shift();
};
const next = spawn(
	process.execPath,
	["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
	{
		cwd: process.cwd(),
		env: {
			...process.env,
			DEV_AUTH_ENABLED: "0",
			NEXTAUTH_URL: baseUrl,
			NEXT_TELEMETRY_DISABLED: "1",
			NODE_ENV: "production",
		},
		stdio: ["ignore", "pipe", "pipe"],
	},
);
next.stdout.on("data", rememberOutput);
next.stderr.on("data", rememberOutput);

const stopServer = async () => {
	if (next.exitCode !== null) return;
	next.kill("SIGTERM");
	await Promise.race([
		once(next, "exit"),
		wait(5_000).then(() => {
			if (next.exitCode === null) next.kill("SIGKILL");
		}),
	]);
};

const waitForReady = async () => {
	for (let attempt = 0; attempt < 120; attempt += 1) {
		if (next.exitCode !== null) throw new Error(`Next exited before becoming ready (${next.exitCode})`);
		try {
			if ((await fetch(`${baseUrl}/api/readyz`)).ok) return;
		} catch {
			// The production server is still starting.
		}
		await wait(500);
	}
	throw new Error("Next did not become ready within 60 seconds");
};

const participantId = randomBytes(16).toString("base64url");
const eventId = `pwa-${randomBytes(8).toString("hex")}`;
const eventName = `PWA offline event ${eventId.slice(-6)}`;
const eventNameFr = `Événement hors ligne PWA ${eventId.slice(-6)}`;
const participant = participantSchema.parse({
	id: participantId,
	tShirtSize: "M",
	mealCategory: "OTHER",
	acceptanceExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	walkIn: false,
});
const sheetsIntegrationApiKey = process.env.SHEETS_INTEGRATION_API_KEY;
if (!sheetsIntegrationApiKey) throw new Error("SHEETS_INTEGRATION_API_KEY is required for the PWA E2E test.");
const integrationHeaders = {
	Authorization: `Bearer ${sheetsIntegrationApiKey}`,
	"Content-Type": "application/json",
};
const prisma = new PrismaClient();
let browser: Browser | undefined;

const closeBrowser = async () => {
	if (browser) await browser.close();
};

const cleanUp = async () => {
	const presences = await prisma.presence.findMany({ where: { hackerId: participantId }, select: { id: true } });
	await prisma.$transaction([
		prisma.log.deleteMany({
			where: {
				OR: [
					{ sourceId: { in: [participantId, ...presences.map(presence => presence.id)] } },
					{ details: { contains: participantId } },
				],
			},
		}),
		prisma.presence.deleteMany({ where: { hackerId: participantId } }),
		prisma.participantSession.deleteMany({ where: { hackerId: participantId } }),
		prisma.claimToken.deleteMany({ where: { hackerId: participantId } }),
		prisma.cancellationCapability.deleteMany({ where: { hackerId: participantId } }),
		prisma.hacker.deleteMany({ where: { id: participantId } }),
		prisma.event.deleteMany({ where: { id: eventId } }),
	]);
};

const visit = async (page: Page, path: string) => {
	await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
};

const waitForCachedSchedule = async (page: Page, expectedEventNames: readonly string[]) => {
	await page.waitForFunction(
		async names => {
			const cache = await caches.open("public-schedule-data");
			const requests = await cache.keys();
			if (requests.length === 0) return false;
			for (const request of requests) {
				const response = await cache.match(request);
				if (!response) return false;
				const body = await response.text();
				if (!names.every(name => body.includes(name))) return false;
			}
			return true;
		},
		expectedEventNames,
		{ timeout: 20_000 },
	);
};

const waitForCachedRoutes = async (page: Page, cacheName: string, paths: readonly string[]) => {
	await page.waitForFunction(
		async ({ name, expectedPaths }) => {
			const cache = await caches.open(name);
			return (
				await Promise.all(
					expectedPaths.map(async path => Boolean(await cache.match(new URL(path, location.origin).href))),
				)
			).every(Boolean);
		},
		{ name: cacheName, expectedPaths: paths },
		{ timeout: 20_000 },
	);
};

try {
	await waitForReady();
	for (const url of publicPrecacheUrls) {
		const response = await fetch(`${baseUrl}${url}`);
		assert.equal(response.ok, true, `Precache URL ${url} returned ${response.status}`);
	}

	const eventStart = new Date(Date.now() + 60 * 60 * 1000);
	await prisma.event.create({
		data: {
			id: eventId,
			name: eventName,
			nameFr: eventNameFr,
			room: "PWA test room",
			roomFr: "Salle de test PWA",
			start: eventStart,
			end: new Date(eventStart.getTime() + 60 * 60 * 1000),
			description: "Available from the offline schedule cache.",
			descriptionFr: "Disponible depuis le cache de l’horaire hors ligne.",
			hidden: false,
			type: EventType.GENERAL,
			scannerEnabled: false,
			scannerWorkflow: ScannerWorkflow.ATTENDANCE,
		},
	});

	const provision = await fetch(`${baseUrl}/api/integrations/sheets/hackers`, {
		method: "POST",
		headers: integrationHeaders,
		body: JSON.stringify({ hackers: [participant] }),
	});
	assert.equal(provision.status, 200);
	assert.deepEqual(processedResponseSchema.parse(await provision.json()), { processed: 1 });

	const issueClaim = await fetch(`${baseUrl}/api/integrations/sheets/claim`, {
		method: "POST",
		headers: integrationHeaders,
		body: JSON.stringify(participant),
	});
	assert.equal(issueClaim.status, 200);
	const claimToken = new URL(claimResponseSchema.parse(await issueClaim.json()).claimUrl).hash.slice(1);

	browser = await chromium.launch({
		executablePath: await findChromium(),
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	const context = await browser.newContext();
	const activation = await context.request.post(`${baseUrl}/api/claim`, { data: { token: claimToken } });
	assert.equal(activation.status(), 200);

	const page = await context.newPage();
	await page.goto(`${baseUrl}/profile`, { waitUntil: "domcontentloaded" });
	await page.getByRole("heading", { name: "Your event pass" }).waitFor();
	await page.getByRole("heading", { name: "Your details" }).waitFor();
	const onlineQr = page.getByAltText("Your event QR code");
	await onlineQr.waitFor();
	const onlineQrSource = await onlineQr.getAttribute("src");
	assert.match(onlineQrSource ?? "", /^data:image\/png;base64,/);

	await page.waitForFunction(
		async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
		undefined,
		{ timeout: 20_000 },
	);
	if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

	for (const locale of [
		{ prefix: "", event: eventName, floor: /^Floor / },
		{ prefix: "/fr", event: eventNameFr, floor: /^Niveau / },
	] as const) {
		await visit(page, `${locale.prefix}/schedule`);
		await page.getByText(locale.event, { exact: true }).waitFor();

		await visit(page, `${locale.prefix}/schedule/event?id=${eventId}`);
		await page.getByRole("heading", { name: locale.event }).waitFor();

		await visit(page, `${locale.prefix}/maps`);
		const floorHeadings = page.getByRole("heading", { name: locale.floor });
		await floorHeadings.first().waitFor();
		assert.equal(await floorHeadings.count(), 6);

		await visit(page, `${locale.prefix}/resources`);
		await page.getByRole("link", { name: "CGI" }).waitFor();

		await visit(page, `${locale.prefix}/sponsors/cgi`);
		await page.getByRole("heading", { name: "CGI", exact: true }).waitFor();
		await waitForCachedRoutes(page, locale.prefix ? "public-pages-fr" : "public-pages-en", [
			`${locale.prefix}/schedule`,
			`${locale.prefix}/schedule/event?id=${eventId}`,
			`${locale.prefix}/maps`,
			`${locale.prefix}/resources`,
			`${locale.prefix}/sponsors/cgi`,
		]);
	}
	await waitForCachedSchedule(page, [eventName, eventNameFr]);

	await context.setOffline(true);
	for (const locale of [
		{
			prefix: "",
			event: eventName,
			floor: /^Floor /,
			offlineHeading: "You're offline",
			passHeading: "Your event pass",
			qrAlt: "Your event QR code",
		},
		{
			prefix: "/fr",
			event: eventNameFr,
			floor: /^Niveau /,
			offlineHeading: "Vous êtes hors ligne",
			passHeading: "Votre laissez-passer",
			qrAlt: "Votre code QR pour l’événement",
		},
	] as const) {
		await visit(page, `${locale.prefix}/schedule`);
		await page.getByText(locale.event, { exact: true }).waitFor();

		await visit(page, `${locale.prefix}/schedule/event?id=${eventId}`);
		await page.getByRole("heading", { name: locale.event }).waitFor();

		await visit(page, `${locale.prefix}/maps`);
		const floorHeadings = page.getByRole("heading", { name: locale.floor });
		await floorHeadings.first().waitFor();
		assert.equal(await floorHeadings.count(), 6);
		const mapResponses = await page.evaluate(async () => {
			const paths = [
				"/assets/maps/floor0.svg",
				"/assets/maps/floor1.svg",
				"/assets/maps/floor2.svg",
				"/assets/maps/floor3.svg",
				"/assets/maps/floor4-current.svg",
				"/assets/maps/floor5.svg",
			];
			return Promise.all(paths.map(async path => ({ path, ok: (await fetch(path)).ok })));
		});
		assert.equal(
			mapResponses.every(response => response.ok),
			true,
			JSON.stringify(mapResponses),
		);

		await visit(page, `${locale.prefix}/resources`);
		await page.getByRole("link", { name: "CGI" }).waitFor();

		await visit(page, `${locale.prefix}/sponsors/cgi`);
		await page.getByRole("heading", { name: "CGI", exact: true }).waitFor();

		await visit(page, `${locale.prefix}/profile`);
		await page.getByRole("heading", { name: locale.passHeading }).waitFor();
		const offlineQr = page.getByAltText(locale.qrAlt);
		await offlineQr.waitFor();
		assert.equal(
			await offlineQr.getAttribute("src"),
			onlineQrSource,
			"Offline pass must preserve the same QR payload",
		);
		const passBody = await page.locator("body").innerText();
		assert.doesNotMatch(
			passBody,
			/Your details|T-shirt size|Meal category|Your attendance|Vos informations|Taille de t-shirt|Catégorie de repas|Votre participation/,
		);

		for (const privatePath of [
			"/qr",
			"/services",
			"/hardware",
			"/latte-lab",
			"/internal/hardware",
			"/internal/latte-lab",
		]) {
			await visit(page, `${locale.prefix}${privatePath}`);
			await page.getByRole("heading", { name: locale.offlineHeading }).waitFor();
		}
	}

	await context.setOffline(false);
	console.info(
		"PWA E2E passed: public EN/FR routes and the QR-only participant pass survived offline reloads while private routes used the offline fallback.",
	);
} catch (error) {
	console.error(serverOutput.join(""));
	throw error;
} finally {
	await closeBrowser();
	await cleanUp().catch(error => console.error("PWA E2E cleanup failed:", error));
	await prisma.$disconnect();
	await stopServer();
	if (process.env.NEXT_DIST_DIR === ".next-pwa-e2e") {
		await rm(join(process.cwd(), ".next-pwa-e2e"), { recursive: true, force: true });
	}
}
