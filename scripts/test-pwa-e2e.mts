import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium, type Browser } from "playwright-core";
import { z } from "zod";

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
const claimResponseSchema = z.object({ claimUrl: z.string().url() }).strict();

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
	]);
};

try {
	await waitForReady();
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

	await context.setOffline(true);
	await page.reload({ waitUntil: "domcontentloaded" });
	await page.getByRole("heading", { name: "Your offline event pass" }).waitFor();
	const offlineQr = page.getByAltText("Your event QR code");
	await offlineQr.waitFor();
	assert.equal(await offlineQr.getAttribute("src"), onlineQrSource, "Offline pass must preserve the same QR payload");
	const offlineBody = await page.locator("body").innerText();
	assert.doesNotMatch(offlineBody, /Your details|T-shirt size|Meal category|Your attendance/);

	await context.setOffline(false);
	console.info(
		"PWA E2E passed: authenticated profile installed the service worker and reloaded offline as the QR-only pass.",
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
