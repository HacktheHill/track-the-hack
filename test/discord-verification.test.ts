import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { readDiscordProof, signDiscordLink, signDiscordRequest } from "@/server/lib/discord-proof";
import { completeDiscordVerification, discordVerificationBodySchema } from "@/server/services/discord-verification";

const secret = "test-discord-shared-secret-at-least-32-characters";
const now = 1_800_000_000_000;
const reference = randomBytes(32).toString("base64url");
const token = signDiscordLink(reference, now / 1000 + 300, secret);
const hackerId = "test-participant-opaque-id";

void test("signed opaque proof rejects tampering, expiry, future expiry, and old raw-ID links", () => {
	assert.equal(readDiscordProof(token, secret, now)?.reference, reference);
	assert.equal(readDiscordProof(token, "different-secret", now), null);
	assert.equal(readDiscordProof(token, secret, now + 300_000), null);
	assert.equal(readDiscordProof(signDiscordLink(reference, now / 1000 + 331, secret), secret, now), null);
	assert.equal(readDiscordProof(token.replace(reference, randomBytes(32).toString("base64url")), secret, now), null);
	assert.equal(readDiscordProof("123456789012345678", secret, now), null);
	assert.equal(discordVerificationBodySchema.safeParse({ token, hackerId }).success, false);
	assert.equal(discordVerificationBodySchema.safeParse({ token, discordId: "123456789012345678" }).success, false);
});

void test("completion signs the exact payload and exposes only a fixed success/error vocabulary", async () => {
	const config = { secret, botUrl: "https://bot.example" };
	const sent: typeof fetch = (url, options) => {
		assert.equal(String(url), "https://bot.example/verify");
		const body = JSON.stringify({ token, hackerId });
		assert.equal(options?.body, body);
		const headers = new Headers(options?.headers);
		assert.equal(headers.get("x-track-the-hack-signature"), signDiscordRequest(body, String(now / 1000), secret));
		assert.equal(options?.redirect, "error");
		return Promise.resolve(Response.json({ ok: true }));
	};
	assert.equal(await completeDiscordVerification(token, hackerId, config, sent, now), "verified");
	assert.equal(
		await completeDiscordVerification(
			"invalid",
			hackerId,
			config,
			() => {
				throw new Error("Must not contact bot");
			},
			now,
		),
		"invalid",
	);
	for (const [code, expected] of [
		[410, "invalid"],
		[403, "unavailable"],
		[500, "unavailable"],
	] as const) {
		assert.equal(
			await completeDiscordVerification(
				token,
				hackerId,
				config,
				() => Promise.resolve(Response.json({ discordId: "private", error: "private" }, { status: code })),
				now,
			),
			expected,
		);
	}
	for (const [reason, expected] of [
		["discord-account-linked", "discord-account-conflict"],
		["participant-linked", "participant-conflict"],
		["both-linked", "conflict"],
	] as const) {
		assert.equal(
			await completeDiscordVerification(
				token,
				hackerId,
				config,
				() => Promise.resolve(Response.json({ ok: false, reason }, { status: 409 })),
				now,
			),
			expected,
		);
	}
	assert.equal(
		await completeDiscordVerification(
			token,
			hackerId,
			config,
			() => Promise.resolve(Response.json({ ok: false, reason: "private" }, { status: 409 })),
			now,
		),
		"conflict",
	);
	assert.equal(
		await completeDiscordVerification(
			token,
			hackerId,
			config,
			() => Promise.resolve(Response.json({ ok: true, discordId: "private" })),
			now,
		),
		"unavailable",
	);
	assert.equal(
		await completeDiscordVerification(token, hackerId, config, () => Promise.reject(new Error("private")), now),
		"unavailable",
	);
});
