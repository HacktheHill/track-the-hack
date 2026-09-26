import assert from "node:assert/strict";
import test from "node:test";
import {
	createOrganizerEmailConfirmationUrl,
	parseOrganizerEmailConfirmationFragment,
} from "@/server/lib/organizer-email-confirmation";

const origin = "https://tracker.hackthehill.com";
const callbackUrl = `${origin}/internal/access`;
const verificationUrl = `${origin}/api/auth/callback/email?${new URLSearchParams({
	callbackUrl,
	email: "sabad030@uottawa.ca",
	token: "single-use-token",
}).toString()}`;

void test("email scanners receive a confirmation page without redeeming the token", () => {
	const confirmationUrl = new URL(createOrganizerEmailConfirmationUrl(verificationUrl));
	assert.equal(confirmationUrl.origin, origin);
	assert.equal(confirmationUrl.pathname, "/auth/verify-email");
	assert.equal(confirmationUrl.search, "");
	assert.match(confirmationUrl.hash, /token=single-use-token/);

	const confirmation = parseOrganizerEmailConfirmationFragment(confirmationUrl.hash, origin);
	assert.equal(confirmation?.email, "sabad030@uottawa.ca");
	assert.equal(confirmation?.verificationUrl, verificationUrl);
});

void test("confirmation rejects incomplete or cross-origin callback fragments", () => {
	assert.equal(parseOrganizerEmailConfirmationFragment("#email=sabad030%40uottawa.ca", origin), null);
	assert.equal(
		parseOrganizerEmailConfirmationFragment(
			new URLSearchParams({
				callbackUrl: "https://attacker.example/",
				email: "sabad030@uottawa.ca",
				token: "single-use-token",
			}).toString(),
			origin,
		),
		null,
	);
});
