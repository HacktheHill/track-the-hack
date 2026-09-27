import assert from "node:assert/strict";
import test from "node:test";
import navbarEn from "@root/public/locales/en/navbar.json";
import navbarFr from "@root/public/locales/fr/navbar.json";
import winnersEn from "@root/public/locales/en/winners.json";
import winnersFr from "@root/public/locales/fr/winners.json";
import { cgiWinners, civicWinners, generalWinners, miniChallengeWinners, mlhChallengeWinners } from "@/pages/winners";

void test("the published results contain the confirmed main challenge placements", () => {
	assert.deepEqual(
		generalWinners.map(({ place, name }) => ({ place, name })),
		[
			{ place: "first", name: "Dx – Simulated Patient Diagnosis Platform" },
			{ place: "second", name: "gymlens" },
			{ place: "third", name: "Babbli" },
		],
	);
	assert.deepEqual(
		civicWinners.map(({ place, name }) => ({ place, name })),
		[
			{ place: "first", name: "VitaSpectra" },
			{ place: "second", name: "Porchlight" },
			{ place: "third", name: "evidently" },
		],
	);
	assert.deepEqual(
		cgiWinners.map(({ place, name }) => ({ place, name })),
		[
			{ place: "first", name: "NorthFlow" },
			{ place: "second", name: "TrueSight" },
			{ place: "third", name: "MK Solutions" },
		],
	);
});

void test("the published results contain only the four confirmed mini challenge awards", () => {
	assert.deepEqual(
		miniChallengeWinners.map(({ award, name }) => ({ award, name })),
		[
			{ award: "best-foss", name: "Guitaroids" },
			{ award: "best-ui-ux", name: "Babbli" },
			{ award: "best-hardware", name: "Flick Note" },
			{ award: "mathematech", name: "Babbli" },
		],
	);
});

void test("MathemaTech and the confirmed MLH awards are published", () => {
	assert.deepEqual(
		miniChallengeWinners.find(({ award }) => award === "mathematech"),
		{
			award: "mathematech",
			name: "Babbli",
			url: "https://devpost.com/software/babbli",
			image: "/assets/winners/babbli-original.png",
		},
	);
	assert.deepEqual(
		mlhChallengeWinners.map(({ award, name }) => ({ award, name })),
		[
			{ award: "best-gemini", name: "Mamdani" },
			{ award: "best-auth0", name: "Follow the Bill" },
			{ award: "best-elevenlabs", name: "Babbli" },
			{ award: "best-vultr", name: "Arrive" },
			{ award: "best-tiger-data", name: "What the Hill" },
			{ award: "best-domain-name", name: "pleasehelpme.study" },
			{ award: "best-presage", name: "MindSpace" },
			{ award: "best-solana", name: "Versus" },
		],
	);
});

void test("every winner has a public Devpost project URL and a local thumbnail", () => {
	for (const winner of [
		...generalWinners,
		...civicWinners,
		...cgiWinners,
		...miniChallengeWinners,
		...mlhChallengeWinners,
	]) {
		assert.match(winner.url, /^https:\/\/devpost\.com\/software\/[a-z0-9-]+$/);
		assert.match(winner.image, /^\/assets\/winners\/[a-z0-9-]+\.(?:jpe?g|png)$/);
	}
});

void test("winner navigation and page copy are bilingual", () => {
	assert.equal(navbarEn.winners, "Winners");
	assert.equal(navbarFr.winners, "Gagnants");
	assert.equal(winnersEn.title, "Hack the Hill III winners");
	assert.equal(winnersFr.title, "Gagnants de Hack the Hill III");
});
