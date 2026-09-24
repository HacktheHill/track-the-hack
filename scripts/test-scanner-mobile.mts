import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

// Run against a seeded local dev server. Only participant lookup is exercised;
// choosing an event below does not submit a presence mutation.
const baseUrl = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname), "Use a local development server");
const executablePath = [
	process.env.CHROMIUM_PATH,
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/usr/bin/google-chrome",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((path): path is string => Boolean(path && existsSync(path)));
assert.ok(executablePath, "Set CHROMIUM_PATH to an installed Chromium browser");
const browser = await chromium.launch({
	executablePath,
	headless: true,
	args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
try {
	for (const viewport of [
		{ width: 320, height: 568 },
		{ width: 1280, height: 800 },
	]) {
		const context = await browser.newContext({
			viewport,
			isMobile: viewport.width < 1000,
			hasTouch: viewport.width < 1000,
		});
		try {
			const page = await context.newPage();
			page.setDefaultTimeout(30_000);
			await page.goto(
				new URL("/auth/sign-in?callbackUrl=" + encodeURIComponent(new URL("/qr", baseUrl).href), baseUrl).href,
			);
			await page.getByRole("button", { name: "Sign in as local organiser" }).click();
			await page.waitForURL(url => url.pathname === "/qr");
			for (const locale of ["en", "fr"]) {
				await page.goto(new URL(locale === "fr" ? "/fr/qr" : "/qr", baseUrl).href);
				await page
					.getByRole("tab", { name: locale === "fr" ? "Scanner les laissez-passer" : "Scan passes" })
					.click();
				const selector = page.locator("main select");
				await selector.waitFor();
				// Locale changes preserve the selected event in local storage. Force the
				// read-only lookup mode before submitting the participant identifier so
				// this layout test can never create a presence record.
				await selector.selectOption("__view__");
				const assertReachable = async (stage: string) => {
					await page.locator("main").evaluate(element => {
						element.scrollTop = 0;
					});
					const bounds = await selector.evaluate(element => {
						const rect = element.getBoundingClientRect();
						const container = element.closest("main");
						if (!container)
							throw new Error("The scanner selector must live inside the page's main element");
						const main = container.getBoundingClientRect();
						const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
						return {
							top: rect.top,
							bottom: rect.bottom,
							mainTop: main.top,
							mainBottom: main.bottom,
							width: rect.width,
							hit: hit === element,
						};
					});
					assert.ok(
						bounds.top >= bounds.mainTop &&
							bounds.bottom <= bounds.mainBottom &&
							bounds.width > 0 &&
							bounds.hit,
						JSON.stringify({ viewport, locale, stage, bounds }),
					);
				};
				await assertReachable("before lookup");
				const input = page.locator("#scanner-input");
				const video = page.locator("main video");
				const alignment = await Promise.all(
					[video, input].map(async locator => {
						const box = await locator.boundingBox();
						assert.ok(box);
						return box.x + box.width / 2;
					}),
				);
				const [videoCentre, inputCentre] = alignment;
				if (videoCentre === undefined || inputCentre === undefined)
					throw new Error("Expected scanner video and input alignment measurements");
				assert.ok(Math.abs(videoCentre - inputCentre) < 1, JSON.stringify({ viewport, locale, alignment }));
				assert.equal(await page.locator("main form button").count(), 0);
				await input.fill("dev-participant-normal-01");
				await input.press("Enter");
				await page.getByText("dev-participant-normal-01", { exact: true }).waitFor();
				await assertReachable("after lookup");
				// Verify an actual event can be selected once the result card exists.
				await page.locator('main select option[value="dev-event-check-in"]').waitFor({ state: "attached" });
				await selector.selectOption("dev-event-check-in");
				assert.equal(await selector.inputValue(), "dev-event-check-in");
				console.info(`PASS ${viewport.width}x${viewport.height} ${locale}`);
			}
		} finally {
			await context.close();
		}
	}
} finally {
	await browser.close();
}
