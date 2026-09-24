import assert from "node:assert/strict";
import test from "node:test";
import { parseOrganizerProvisionInput } from "@/server/lib/organizer-provision";

void test("operator CLI accepts an optional admin flag", () => {
	assert.deepEqual(parseOrganizerProvisionInput([" Daniel.Thorp@ctn-rtc.org ", "--admin"], {}), {
		email: "daniel.thorp@ctn-rtc.org",
		admin: true,
	});
	assert.deepEqual(parseOrganizerProvisionInput(["organiser@example.com"], {}), {
		email: "organiser@example.com",
		admin: false,
	});
});

void test("production job accepts only explicit environment values", () => {
	assert.deepEqual(
		parseOrganizerProvisionInput([], {
			ORGANIZER_PROVISION_EMAIL: " Agam.Singh@ctn-rtc.org ",
			ORGANIZER_PROVISION_ADMINISTRATOR: "true",
		}),
		{ email: "agam.singh@ctn-rtc.org", admin: true },
	);
	assert.throws(() =>
		parseOrganizerProvisionInput([], {
			ORGANIZER_PROVISION_EMAIL: "agam.singh@ctn-rtc.org",
			ORGANIZER_PROVISION_ADMINISTRATOR: "1",
		}),
	);
});

void test("CLI arguments take precedence over workflow environment", () => {
	assert.deepEqual(
		parseOrganizerProvisionInput(["organiser@example.com"], {
			ORGANIZER_PROVISION_EMAIL: "daniel.thorp@ctn-rtc.org",
			ORGANIZER_PROVISION_ADMINISTRATOR: "true",
		}),
		{ email: "organiser@example.com", admin: false },
	);
});
